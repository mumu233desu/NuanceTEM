<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { db } from '../db';

const dbUpdateTime = ref('读取中...');

onMounted(async () => {
  try {
    const res = await fetch('/data/questions.json', { method: 'HEAD' });
    const lastModified = res.headers.get('Last-Modified');
    if (lastModified) {
      const date = new Date(lastModified);
      dbUpdateTime.value = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      dbUpdateTime.value = '2026年6月11日';
    }
  } catch (e) {
    dbUpdateTime.value = '2026年6月11日';
  }
});

const importStatus = ref('');
const importMessage = ref('');
const isImporting = ref(false);

const dailyTarget = ref(Number(localStorage.getItem('dailyTarget')) || 20);

// Watch for changes and save to localStorage
watch(dailyTarget, (newVal) => {
  if (newVal < 1) dailyTarget.value = 1;
  if (newVal > 1000) dailyTarget.value = 1000;
  localStorage.setItem('dailyTarget', dailyTarget.value.toString());
});

const handleExport = async () => {
  try {
    const progressList = await db.progress.toArray();
    const logsList = await db.logs.toArray();

    const backupData = {
      version: 2, // Bumped version to support settings
      appName: 'NuanceTEM',
      timestamp: Date.now(),
      progress: progressList,
      logs: logsList,
      settings: {
        dailyTarget: dailyTarget.value
      }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nuancetem-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出进度失败：' + err);
  }
};

const handleImport = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  isImporting.value = true;
  importStatus.value = 'loading';
  importMessage.value = '正在读取备份文件...';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const backupData = JSON.parse(e.target?.result as string);
      
      // Basic validation
      if (backupData.appName !== 'NuanceTEM' || !backupData.progress || !backupData.logs) {
        throw new Error('无效的备份文件：文件格式不兼容。');
      }

      const mergeChoice = confirm(
        `读取成功！备份包含：\n- ${backupData.progress.length} 条进度记录\n- ${backupData.logs.length} 条学习日志\n\n点击“确定”合并当前进度（保留本地最新记录），点击“取消”完全覆盖当前进度。`
      );

      if (mergeChoice) {
        // MERGE: merge entries
        const localProgress = await db.progress.toArray();
        const localMap = new Map(localProgress.map(p => [p.questionId, p]));

        const progressToPut = [];
        for (const p of backupData.progress) {
          const local = localMap.get(p.questionId);
          if (!local || p.lastAnswered > local.lastAnswered) {
            progressToPut.push(p);
          }
        }

        if (progressToPut.length > 0) {
          await db.progress.bulkPut(progressToPut);
        }
        
        await db.logs.bulkPut(backupData.logs);
      } else {
        // OVERWRITE: clear and write
        await db.progress.clear();
        await db.logs.clear();
        
        await db.progress.bulkPut(backupData.progress);
        await db.logs.bulkPut(backupData.logs);
      }

      // Restore settings if present
      if (backupData.settings && backupData.settings.dailyTarget) {
        dailyTarget.value = backupData.settings.dailyTarget;
      }

      importStatus.value = 'success';
      importMessage.value = '备份导入成功！请刷新页面查看最新进度。';
      alert('备份恢复成功！');
    } catch (err) {
      importStatus.value = 'error';
      importMessage.value = '导入失败：' + (err as Error).message;
    } finally {
      isImporting.value = false;
      input.value = '';
    }
  };

  reader.onerror = () => {
    importStatus.value = 'error';
    importMessage.value = '读取文件出错。';
    isImporting.value = false;
  };

  reader.readAsText(file);
};

const handleResetAll = async () => {
  if (confirm('警告：此操作将永久抹除所有错题记录、已熟记列表及学习进度，恢复为未学习状态！您确定要重置吗？')) {
    try {
      await db.logs.clear();
      
      const progressList = await db.progress.toArray();
      const resetEntries = progressList.map(p => ({
        ...p,
        status: 'new' as const,
        interval: 0,
        ease: 2.5,
        repetitions: 0,
        nextReview: 0,
        lastAnswered: 0,
      }));
      
      await db.progress.bulkPut(resetEntries);
      alert('所有学习记录已重置完毕！');
    } catch (err) {
      alert('重置进度失败：' + err);
    }
  }
};
</script>

<template>
  <div class="settings-view slide-up">
    <div class="header">
      <h2>系统设置</h2>
      <p>管理您的学习进度备份，或重置系统数据。</p>
    </div>

    <div class="settings-grid">
      <!-- Learning Preferences -->
      <div class="settings-card glass-card">
        <h3>学习目标</h3>
        <p class="description">设定您每天计划完成的新题目和复习题目总数。</p>
        
        <div class="setting-item">
          <label for="daily-target">每日打卡目标 (题)</label>
          <div class="input-group">
            <input id="daily-target" type="number" v-model.number="dailyTarget" min="1" max="1000" class="num-input" />
          </div>
        </div>
      </div>

      <!-- Sync / Backup Section -->
      <div class="settings-card glass-card">
        <h3>数据备份与迁移</h3>
        <p class="description">
          由于 NuanceTEM 采用纯前端离线架构，所有数据均保存在您的本地浏览器中。如果您需要更换设备或防止数据丢失，请定期备份您的记录。
        </p>
        
        <div class="backup-actions">
          <button @click="handleExport" class="btn-action export">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出学习记录 (.json)
          </button>
          
          <div class="import-wrapper">
            <label for="import-file" class="btn-action import">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              导入学习记录
            </label>
            <input @change="handleImport" id="import-file" type="file" accept=".json" class="hidden-input" />
          </div>
        </div>

        <div v-if="importMessage" class="import-status" :class="importStatus">
          {{ importMessage }}
        </div>
      </div>

      <!-- Reset / Danger Zone -->
      <div class="settings-card glass-card danger-zone">
        <h3>危险区域</h3>
        <p class="description">
          重置进度将会删除您的所有学习历史日志，并将错题本和熟记词汇的状态复原。此操作不可撤销，请谨慎操作。
        </p>
        
        <button @click="handleResetAll" class="btn-danger">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          完全重置所有数据
        </button>
      </div>

      <!-- About Info -->
      <div class="settings-card glass-card about-card">
        <h3>关于 NuanceTEM</h3>
        <p class="description">
          NuanceTEM 是一款旨在为 TEM-4 & TEM-8 备考的英语专业学生提供精准同义词辨析的学习工具。本应用基于 Vite, Vue 3, TypeScript 与 IndexedDB 搭建，提供完全本地化、无网络阻碍的复习学习体验。
        </p>
        <div class="version-info">
          <p>软件版本: <strong>v1.0.0 (Serverless)</strong></p>
          <p>存储引擎: <strong>IndexedDB (Dexie.js)</strong></p>
          <p>题库更新时间: <strong>{{ dbUpdateTime }}</strong></p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
}

.settings-card h3 {
  font-size: 1.25rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  margin-top: 0.5rem;
}

.setting-item label {
  font-weight: 600;
  color: var(--text-main);
  font-size: 0.95rem;
}

.num-input {
  padding: 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-app);
  width: 120px;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.num-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-light);
}

.description {
  font-size: 0.95rem;
  color: var(--text-muted);
}

.backup-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  width: 100%;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  transition: all 0.2s ease;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-action:hover {
  border-color: var(--primary);
  color: var(--primary);
  background-color: var(--primary-light);
  transform: translateY(-1px);
}

.btn-action svg {
  width: 18px;
  height: 18px;
}

.hidden-input {
  display: none;
}

.import-status {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  margin-top: 0.5rem;
}

.import-status.success { background-color: var(--success-light); color: var(--success); }
.import-status.error { background-color: var(--error-light); color: var(--error); }
.import-status.loading { background-color: var(--info-light); color: var(--info); }

.danger-zone {
  border-left: 5px solid var(--error);
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--error-light);
  color: var(--error);
  border: 1px solid var(--error);
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.btn-danger:hover {
  background-color: var(--error);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.btn-danger svg {
  width: 18px;
  height: 18px;
}

.about-card {
  background-color: var(--primary-light);
  border-color: var(--primary);
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  border-top: 1px solid rgba(15, 23, 42, 0.05);
  width: 100%;
  padding-top: 0.75rem;
}

[data-theme="dark"] .version-info {
  border-top-color: rgba(255, 255, 255, 0.05);
}

.version-info p {
  color: var(--text-main);
}
</style>
