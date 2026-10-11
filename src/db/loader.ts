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

const MANIFEST_VERSION_KEY = 'nuancetem_manifest_version';

export async function loadQuestionsFromManifest(): Promise<Question[]> {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    // 1. 读取 Manifest 清单 (避免缓存)
    const manifestResp = await fetch(`${baseUrl}data/manifest.json?_t=${Date.now()}`);
    if (!manifestResp.ok) {
      throw new Error('Failed to load manifest.json');
    }
    const manifest: Manifest = await manifestResp.json();
    const version = manifest.version || 'default';

    // 2. 检查本地版本与已有数据，避免无脑全量重复下载
    const cachedVersion = localStorage.getItem(MANIFEST_VERSION_KEY);
    const existingCount = await db.questions.count();
    if (cachedVersion === version && existingCount > 0) {
      console.log(`[Loader] Manifest version (${version}) already loaded. Local DB has ${existingCount} items. Skipping re-download.`);
      return await db.questions.toArray();
    }

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

    // 4. 并行拉取所有考点分包
    const fetchPromises = packagePaths.map(pkgPath =>
      fetch(`${baseUrl}data/${pkgPath}?v=${version}`)
        .then(r => r.ok ? r.json() : [])
        .catch(err => {
          console.warn(`Failed to fetch package ${pkgPath}:`, err);
          return [];
        })
    );

    const results = await Promise.all(fetchPromises);
    const allQuestions: Question[] = results.flat();

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

    // 6. 弱解耦存入本地 IndexedDB，并自动清理不在当前清单中的孤儿废弃题目与进度（保证单一可信源）
    await db.questions.bulkPut(allQuestions);
    const validIdSet = new Set(allQuestions.map(q => q.id));
    const allDbQuestions = await db.questions.toArray();
    const staleQuestionIds = allDbQuestions.filter(q => !validIdSet.has(q.id)).map(q => q.id);
    if (staleQuestionIds.length > 0) {
      console.log(`[Loader] Pruning ${staleQuestionIds.length} stale/deprecated questions and their orphan progress from local cache.`);
      await db.questions.bulkDelete(staleQuestionIds);
      await db.progress.bulkDelete(staleQuestionIds);
    }

    // 7. 仅为缺失进度的题目补充初始进度
    const existingProgress = await db.progress.toArray();
    const existingIds = new Set(existingProgress.map(p => p.questionId));
    const newQuestions = allQuestions.filter(q => !existingIds.has(q.id));
    if (newQuestions.length > 0) {
      const newEntries: Progress[] = newQuestions.map(q => createDefaultProgress(q.id));
      await db.progress.bulkPut(newEntries);
      console.log(`Initialized progress for ${newEntries.length} new questions.`);
    }

    // 记录成功加载的版本号
    localStorage.setItem(MANIFEST_VERSION_KEY, version);
    console.log(`Successfully loaded ${allQuestions.length} questions from ${packagePaths.length} packages (v: ${version}).`);
    return allQuestions;
  } catch (error) {
    console.error('Failed to load questions via manifest:', error);
    // 离线/故障兜底：优先复用本地已存题目，避免拉取旧版未分类数据污染
    const fallbackCount = await db.questions.count();
    if (fallbackCount > 0) {
      console.log(`[Loader Fallback] Utilizing ${fallbackCount} cached questions from IndexedDB.`);
      return await db.questions.toArray();
    }
    return [];
  }
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
