import { ref } from 'vue';
import { db, type Progress } from '../db';
import { useAuth } from './useAuth';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

const status = ref<SyncStatus>('idle');
const lastSyncTime = ref<number | null>(
  Number(localStorage.getItem('nuancetem_last_sync_time')) || null
);
const syncError = ref<string | null>(null);

export function useSync() {
  const { token, isAuthenticated } = useAuth();

  const syncNow = async () => {
    if (!isAuthenticated.value || !token.value) {
      status.value = 'idle';
      return;
    }

    if (!navigator.onLine) {
      status.value = 'offline';
      return;
    }

    status.value = 'syncing';
    syncError.value = null;

    try {
      // 1. 从云端拉取 (Pull)
      const pullRes = await fetch('/api/sync/pull', {
        headers: { Authorization: `Bearer ${token.value}` },
      });

      if (!pullRes.ok) {
        throw new Error('拉取云端数据失败');
      }

      const pullData = await pullRes.json();
      const cloudList: Array<Progress & { updatedAt?: number }> = pullData.progressList || [];
      const cloudMap = new Map(cloudList.map(item => [item.questionId, item]));

      // 2. 获取本地所有进度
      const localList = await db.progress.toArray();
      const localMap = new Map(localList.map(item => [item.questionId, item]));

      const localToUpdate: Progress[] = [];
      const cloudToPush: Array<Progress & { updatedAt: number }> = [];

      // A. 合并本地与云端已有的
      for (const cloudItem of cloudList) {
        const localItem = localMap.get(cloudItem.questionId);
        const cloudTime = cloudItem.updatedAt || cloudItem.lastAnswered || 0;
        const localTime = localItem?.lastAnswered || 0;

        if (!localItem) {
          // 本地缺失，从云端恢复
          localToUpdate.push({
            questionId: cloudItem.questionId,
            status: cloudItem.status,
            interval: cloudItem.interval,
            ease: cloudItem.ease,
            repetitions: cloudItem.repetitions,
            nextReview: cloudItem.nextReview,
            lastAnswered: cloudItem.lastAnswered,
          });
        } else if (cloudTime > localTime && cloudItem.status !== 'new') {
          // 云端更新，同步到本地
          localToUpdate.push({
            questionId: cloudItem.questionId,
            status: cloudItem.status,
            interval: cloudItem.interval,
            ease: cloudItem.ease,
            repetitions: cloudItem.repetitions,
            nextReview: cloudItem.nextReview,
            lastAnswered: cloudItem.lastAnswered,
          });
        }
      }

      // B. 寻找本地较新或已答题的数据推送给云端
      for (const localItem of localList) {
        if (localItem.status === 'new' && localItem.repetitions === 0) continue; // 未答过的不必强制推
        const cloudItem = cloudMap.get(localItem.questionId);
        const cloudTime = cloudItem?.updatedAt || cloudItem?.lastAnswered || 0;
        const localTime = localItem.lastAnswered || 0;

        if (!cloudItem || localTime > cloudTime) {
          cloudToPush.push({
            ...localItem,
            updatedAt: localTime || Date.now(),
          });
        }
      }

      // 3. 执行本地写入
      if (localToUpdate.length > 0) {
        await db.progress.bulkPut(localToUpdate);
      }

      // 4. 执行云端推送 (Push)
      if (cloudToPush.length > 0) {
        const pushRes = await fetch('/api/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.value}`,
          },
          body: JSON.stringify({ items: cloudToPush }),
        });

        if (!pushRes.ok) {
          throw new Error('向云端同步答题记录失败');
        }
      }

      // 更新同步完成状态
      const now = Date.now();
      lastSyncTime.value = now;
      localStorage.setItem('nuancetem_last_sync_time', String(now));
      status.value = 'synced';
    } catch (err: any) {
      console.error('Sync failed:', err);
      status.value = 'error';
      syncError.value = err.message || '网络连接异常';
    }
  };

  return {
    status,
    lastSyncTime,
    syncError,
    syncNow,
  };
}
