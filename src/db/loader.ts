import { db, createDefaultProgress, type Question, type Progress, type StudyLog } from './index';

interface PackageInfo {
  path: string;
  count: number;
  label: string;
}

interface Manifest {
  version: string;
  updated_at: number;
  packages: {
    tem4: Record<string, PackageInfo | number>;
    tem8: Record<string, PackageInfo | number>;
  };
}

export const MANIFEST_VERSION_KEY = 'nuancetem_manifest_version';

function getExpectedTotal(manifest: Manifest): number {
  let count = 0;
  for (const scope of ['tem4', 'tem8'] as const) {
    const scopePackages = manifest.packages[scope];
    if (scopePackages) {
      if (typeof scopePackages.total_count === 'number') {
        count += scopePackages.total_count;
      } else {
        for (const info of Object.values(scopePackages)) {
          if (typeof info === 'object' && typeof info.count === 'number') {
            count += info.count;
          }
        }
      }
    }
  }
  return count;
}

export async function loadQuestionsFromManifest(forceReload = false): Promise<Question[]> {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    // 1. 读取 Manifest 清单 (强制避免任何中间层 HTTP 缓存)
    const manifestResp = await fetch(`${baseUrl}data/manifest.json?_t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!manifestResp.ok) {
      throw new Error(`Failed to load manifest.json (status: ${manifestResp.status})`);
    }
    const manifest: Manifest = await manifestResp.json();
    const version = manifest.version || 'default';
    const expectedTotal = getExpectedTotal(manifest);

    // 2. 检查本地版本与已有数据完整性
    // 只有在非强制重载、版本一致、且本地题目数达到预期总数（防止历史中断残留）时，才复用缓存
    const cachedVersion = localStorage.getItem(MANIFEST_VERSION_KEY);
    const existingCount = await db.questions.count();
    if (!forceReload && cachedVersion === version && existingCount >= expectedTotal) {
      console.log(`[Loader] Manifest version (${version}) already loaded. Local DB has ${existingCount} items (expected >= ${expectedTotal}). Skipping re-download.`);
      return await db.questions.toArray();
    }

    if (existingCount < expectedTotal && cachedVersion === version) {
      console.warn(`[Loader] Integrity mismatch detected: local DB has ${existingCount} questions, but manifest declared ${expectedTotal}. Triggering repair download.`);
    }

    // 3. 收集所有题包路径及预期条数
    const packageEntries: { path: string; count?: number }[] = [];
    for (const scope of ['tem4', 'tem8'] as const) {
      const scopePackages = manifest.packages[scope];
      if (scopePackages) {
        for (const info of Object.values(scopePackages)) {
          if (typeof info === 'object' && info.path) {
            packageEntries.push({ path: info.path, count: info.count });
          }
        }
      }
    }

    // 4. 并行拉取所有考点分包（带失败指数退避重试，防止移动弱网波动）
    const fetchPackageWithRetry = async (pkg: { path: string; count?: number }, maxRetries = 2): Promise<Question[]> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const resp = await fetch(`${baseUrl}data/${pkg.path}?v=${version}`);
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
          }
          const list: Question[] = await resp.json();
          if (pkg.count !== undefined && list.length !== pkg.count) {
            console.warn(`[Loader] Package ${pkg.path} returned ${list.length} items (expected ${pkg.count}).`);
          }
          return list;
        } catch (err) {
          if (attempt === maxRetries) {
            throw new Error(`Failed to fetch package ${pkg.path} after ${maxRetries + 1} attempts: ${err}`);
          }
          await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        }
      }
      return [];
    };

    const results = await Promise.all(packageEntries.map(pkg => fetchPackageWithRetry(pkg)));
    const allQuestions: Question[] = results.flat();

    if (expectedTotal > 0 && allQuestions.length < expectedTotal) {
      throw new Error(`Downloaded questions count (${allQuestions.length}) is below required manifest total (${expectedTotal}). Aborting partial update.`);
    }

    // 5. 读取老 ID 映射字典，进行老数据无损平滑迁移（同步清理旧题目与流水）
    try {
      const mappingResp = await fetch(`${baseUrl}data/id_mapping.json?v=${version}`);
      if (mappingResp.ok) {
        const idMapping: Record<string, string> = await mappingResp.json();
        await migrateLegacyProgress(idMapping);
      }
    } catch (e) {
      console.warn('ID mapping migration skipped:', e);
    }

    // 6. 原子存入本地 IndexedDB，并自动清理不在当前清单中的孤儿废弃题目与进度（保证单一可信源）
    await db.transaction('rw', [db.questions, db.progress], async () => {
      await db.questions.bulkPut(allQuestions);
      const validIdSet = new Set(allQuestions.map(q => q.id));
      const allDbQuestions = await db.questions.toArray();
      const staleQuestionIds = allDbQuestions.filter(q => !validIdSet.has(q.id)).map(q => q.id);
      if (staleQuestionIds.length > 0) {
        console.log(`[Loader] Pruning ${staleQuestionIds.length} stale/deprecated questions and their orphan progress from local cache.`);
        await db.questions.bulkDelete(staleQuestionIds);
        await db.progress.bulkDelete(staleQuestionIds);
      }
    });

    // 7. 仅为缺失进度的题目补充初始进度
    const existingProgress = await db.progress.toArray();
    const existingIds = new Set(existingProgress.map(p => p.questionId));
    const newQuestions = allQuestions.filter(q => !existingIds.has(q.id));
    if (newQuestions.length > 0) {
      const newEntries: Progress[] = newQuestions.map(q => createDefaultProgress(q.id));
      await db.progress.bulkPut(newEntries);
      console.log(`Initialized progress for ${newEntries.length} new questions.`);
    }

    // 8. 仅在全部数据校验通过并入库后，固化本地版本号
    localStorage.setItem(MANIFEST_VERSION_KEY, version);
    console.log(`Successfully loaded ${allQuestions.length} questions from ${packageEntries.length} packages (v: ${version}).`);
    return allQuestions;
  } catch (error) {
    console.error('Failed to load questions via manifest:', error);
    if (forceReload) {
      throw error;
    }
    // 离线/故障兜底：优先复用本地已存题目，避免拉取旧版未分类数据污染
    const fallbackCount = await db.questions.count();
    if (fallbackCount > 0) {
      console.log(`[Loader Fallback] Utilizing ${fallbackCount} cached questions from IndexedDB.`);
      return await db.questions.toArray();
    }
    return [];
  }
}

// 强制清除版本标记并全量重新同步题库（不影响已有答题记录）
export async function forceReloadQuestions(): Promise<{ success: boolean; total: number; message: string }> {
  localStorage.removeItem(MANIFEST_VERSION_KEY);
  const questions = await loadQuestionsFromManifest(true);
  return {
    success: true,
    total: questions.length,
    message: `题库同步成功！已载入 ${questions.length} 道题目。`
  };
}

// 获取当前本地题库状态
export async function getQuestionBankStats(): Promise<{
  total: number;
  tem4: number;
  tem8: number;
  version: string;
}> {
  const total = await db.questions.count();
  const tem4 = await db.questions.where('level').equals('TEM-4').count();
  const tem8 = await db.questions.where('level').equals('TEM-8').count();
  const version = localStorage.getItem(MANIFEST_VERSION_KEY) || '未同步';
  return { total, tem4, tem8, version };
}

// 老用户数据无损迁移（包含 progress 表、questions 表清理与 logs 表迁移）
async function migrateLegacyProgress(idMapping: Record<string, string>) {
  const legacyIds = Object.keys(idMapping);
  if (legacyIds.length === 0) return;

  // 1. 迁移进度表 (progress)
  const allProgress = await db.progress.toArray();
  const progressToUpdate: Progress[] = [];
  const progressToDeleteKeys: string[] = [];

  for (const prog of allProgress) {
    const newId = idMapping[prog.questionId];
    if (newId && newId !== prog.questionId) {
      progressToUpdate.push({
        ...prog,
        questionId: newId,
        updatedAt: prog.updatedAt || Date.now(),
      });
      progressToDeleteKeys.push(prog.questionId);
    }
  }

  // 2. 清理旧题目表幽灵数据 (questions)
  const legacyQuestionCount = await db.questions.where('id').anyOf(legacyIds).count();

  // 3. 迁移流水表 (logs)
  const allLogs = await db.logs.toArray();
  const logsToUpdate: StudyLog[] = [];
  for (const log of allLogs) {
    const newId = idMapping[log.questionId];
    if (newId && newId !== log.questionId) {
      logsToUpdate.push({
        ...log,
        questionId: newId,
      });
    }
  }

  if (progressToUpdate.length > 0 || legacyQuestionCount > 0 || logsToUpdate.length > 0) {
    console.log(`[Migration] Migrating ${progressToUpdate.length} progress records, deleting ${legacyQuestionCount} legacy questions, and updating ${logsToUpdate.length} study logs...`);
    await db.transaction('rw', [db.progress, db.questions, db.logs], async () => {
      if (progressToDeleteKeys.length > 0) {
        await db.progress.bulkDelete(progressToDeleteKeys);
      }
      if (progressToUpdate.length > 0) {
        await db.progress.bulkPut(progressToUpdate);
      }
      if (legacyIds.length > 0) {
        await db.questions.bulkDelete(legacyIds);
      }
      if (logsToUpdate.length > 0) {
        await db.logs.bulkPut(logsToUpdate);
      }
    });
    console.log('[Migration] Legacy migration finished cleanly.');
  }
}
