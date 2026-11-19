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

export async function loadQuestionsFromManifest(forceReload = false): Promise<Question[]> {
  try {
    const baseUrl = import.meta.env.BASE_URL;

    // 1. 读取云端 Manifest 清单（通过 no-store 穿透缓存，始终探查云端真实最新版本号）
    const manifestResp = await fetch(`${baseUrl}data/manifest.json?_t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!manifestResp.ok) {
      throw new Error(`Failed to load manifest.json (status: ${manifestResp.status})`);
    }
    const manifest: Manifest = await manifestResp.json();
    const cloudVersion = manifest.version || 'default';
    const localVersion = localStorage.getItem(MANIFEST_VERSION_KEY);
    const existingCount = await db.questions.count();

    // 2. 直接比对本地与云端版本号：版本一致且本地有数据时，直接秒开本地缓存
    if (!forceReload && localVersion === cloudVersion && existingCount > 0) {
      console.log(`[Loader] Question bank version (${cloudVersion}) is up to date (${existingCount} items). Skipping download.`);
      return await db.questions.toArray();
    }

    console.log(`[Loader] Updating question bank: local (${localVersion || 'none'}) -> cloud (${cloudVersion})...`);

    // 3. 收集所有题包路径
    const packagePaths: string[] = [];
    for (const scope of ['tem4', 'tem8'] as const) {
      const scopePackages = manifest.packages[scope];
      if (scopePackages) {
        for (const info of Object.values(scopePackages)) {
          if (typeof info === 'object' && info.path) {
            packagePaths.push(info.path);
          }
        }
      }
    }

    // 4. 并行拉取各考点分包（网络失败时不吞异常，防止半拉取假成功）
    const fetchPackageWithRetry = async (pkgPath: string, maxRetries = 2): Promise<Question[]> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const resp = await fetch(`${baseUrl}data/${pkgPath}?v=${cloudVersion}`);
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
          }
          return await resp.json();
        } catch (err) {
          if (attempt === maxRetries) {
            throw new Error(`Failed to fetch package ${pkgPath}: ${err}`);
          }
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      return [];
    };

    const results = await Promise.all(packagePaths.map(p => fetchPackageWithRetry(p)));
    const allQuestions: Question[] = results.flat();

    // 5. 迁移旧数据映射（无损平滑兼容）
    try {
      const mappingResp = await fetch(`${baseUrl}data/id_mapping.json?v=${cloudVersion}`);
      if (mappingResp.ok) {
        const idMapping: Record<string, string> = await mappingResp.json();
        await migrateLegacyProgress(idMapping);
      }
    } catch (e) {
      console.warn('ID mapping migration skipped:', e);
    }

    // 6. 原子写入本地 IndexedDB，并清理不在当前清单中的孤儿废弃题目
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

    // 7. 仅为新增题目初始化默认学习进度
    const existingProgress = await db.progress.toArray();
    const existingIds = new Set(existingProgress.map(p => p.questionId));
    const newQuestions = allQuestions.filter(q => !existingIds.has(q.id));
    if (newQuestions.length > 0) {
      const newEntries: Progress[] = newQuestions.map(q => createDefaultProgress(q.id));
      await db.progress.bulkPut(newEntries);
      console.log(`Initialized progress for ${newEntries.length} new questions.`);
    }

    // 8. 只有在全部题包拉取完成且成功入库后，才将本地版本号置为云端最新版本号！
    localStorage.setItem(MANIFEST_VERSION_KEY, cloudVersion);
    console.log(`Successfully updated question bank to v${cloudVersion} (${allQuestions.length} questions).`);
    return allQuestions;
  } catch (error) {
    console.error('Failed to sync questions from manifest:', error);
    if (forceReload) {
      throw error;
    }
    // 离线/异常降级：复用本地已存题目（但不改动本地版本号，下次联网时将自动重试）
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
