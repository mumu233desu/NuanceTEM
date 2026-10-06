import { db, createDefaultProgress, type Question, type Progress } from './index';

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

    // 2. 收集所有题包路径
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

    // 3. 并行拉取所有考点分包
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

    // 4. 读取老 ID 映射字典，进行老数据无损平滑迁移
    try {
      const mappingResp = await fetch(`${baseUrl}data/id_mapping.json?v=${version}`);
      if (mappingResp.ok) {
        const idMapping: Record<string, string> = await mappingResp.json();
        await migrateLegacyProgress(idMapping);
      }
    } catch (e) {
      console.warn('ID mapping migration skipped:', e);
    }

    // 5. 弱解耦存入本地 IndexedDB
    await db.questions.bulkPut(allQuestions);

    // 6. 仅为缺失进度的题目补充初始进度
    const existingProgress = await db.progress.toArray();
    const existingIds = new Set(existingProgress.map(p => p.questionId));
    const newQuestions = allQuestions.filter(q => !existingIds.has(q.id));
    if (newQuestions.length > 0) {
      const newEntries: Progress[] = newQuestions.map(q => createDefaultProgress(q.id));
      await db.progress.bulkPut(newEntries);
      console.log(`Initialized progress for ${newEntries.length} new questions.`);
    }

    console.log(`Successfully loaded ${allQuestions.length} questions from ${packagePaths.length} packages.`);
    return allQuestions;
  } catch (error) {
    console.error('Failed to load questions via manifest, falling back to legacy fallback:', error);
    // 兜底回退
    const fallbackResp = await fetch(`${import.meta.env.BASE_URL}data/questions.json`);
    if (fallbackResp.ok) {
      const fallbackData = await fallbackResp.json();
      await db.questions.bulkPut(fallbackData);
      return fallbackData;
    }
    return [];
  }
}

// 老用户进度无损迁移
async function migrateLegacyProgress(idMapping: Record<string, string>) {
  const allProgress = await db.progress.toArray();
  const toUpdate: Progress[] = [];
  const toDeleteKeys: string[] = [];

  for (const prog of allProgress) {
    const newId = idMapping[prog.questionId];
    if (newId && newId !== prog.questionId) {
      // 迁移为新自解释 ID
      toUpdate.push({
        ...prog,
        questionId: newId,
      });
      toDeleteKeys.push(prog.questionId);
    }
  }

  if (toUpdate.length > 0) {
    console.log(`Migrating ${toUpdate.length} legacy progress records to new namespaced IDs...`);
    await db.transaction('rw', db.progress, async () => {
      await db.progress.bulkDelete(toDeleteKeys);
      await db.progress.bulkPut(toUpdate);
    });
    console.log('Legacy progress migration finished.');
  }
}
