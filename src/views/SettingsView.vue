<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { db, createDefaultProgress } from '../db';
import { useAuth } from '../composables/useAuth';
import { useSync } from '../composables/useSync';
import { useTheme } from '../composables/useTheme';

const emit = defineEmits<{
  (e: 'open-auth'): void;
}>();

const { user, isAuthenticated, logout, resetCloudProgress, requestPasswordReset } = useAuth();
const { status: syncStatus, syncNow } = useSync();

const isSendingResetEmail = ref(false);
const handleRequestReset = async () => {
  if (!user.value?.email) return;
  if (!confirm(`将向您的绑定邮箱（${user.value.email}）发送密码重置安全邮件。确认发送吗？`)) return;
  isSendingResetEmail.value = true;
  try {
    const res = await requestPasswordReset(user.value.email);
    alert(res.message || '重置邮件已发送至您的邮箱，请查收并点击链接重置！');
  } catch (err: any) {
    alert('发送重置邮件失败: ' + (err.message || err));
  } finally {
    isSendingResetEmail.value = false;
  }
};

const appVersion = __APP_VERSION__;
const dbUpdateTime = ref('读取中...');

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/questions.json`, { method: 'HEAD' });
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

const { themePreference: currentTheme, setTheme } = useTheme();

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
      importMessage.value = '备份导入成功！正在为您刷新页面...';
      setTimeout(() => {
        window.location.reload();
      }, 1500);
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
  let confirmMessage = '警告：此操作将永久抹除所有错题记录、已熟记列表及学习进度，恢复为未学习状态！您确定要重置吗？';
  if (isAuthenticated.value) {
    confirmMessage = `⚠️ 危险操作确认：\n您当前已登录云端账户（${user.value?.email}）。\n\n此操作将清空本机所有做题记录，并【同时彻底清空云端备份数据库】，确保多设备进度彻底归零。\n\n您确定要彻底重置吗？`;
  }

  if (!confirm(confirmMessage)) return;

  try {
    // 1. 如果已登录，优先彻底清空云端备份数据
    if (isAuthenticated.value) {
      try {
        await resetCloudProgress();
      } catch (e: any) {
        if (!confirm(`清空云端数据时遇到异常（${e.message}）。是否仍要继续清空本地数据？`)) {
          return;
        }
      }
    }

    // 2. 清空本地 logs 和将进度复原为初始状态
    await db.logs.clear();
    const progressList = await db.progress.toArray();
    const resetEntries = progressList.map(p => createDefaultProgress(p.questionId));
    await db.progress.bulkPut(resetEntries);

    // 3. 触发一次同步以固化云端最新空状态
    if (isAuthenticated.value) {
      await syncNow();
    }

    alert(isAuthenticated.value ? '所有本地与云端学习进度已彻底重置为初始状态！' : '所有本地学习记录已重置完毕！');
    window.location.reload();
  } catch (err) {
    alert('重置进度失败：' + err);
  }
};
</script>

<template>
  <div class="settings-view slide-up">
    <div class="header">
      <h2>系统设置</h2>
      <p>管理您的学习进度备份，或重置系统数据。</p>
    </div>

    <!-- Cloud Account & Sync Section (方便移动端与桌面端用户管理账户) -->
      <div class="settings-card glass-card account-card">
        <h3>云端账户与多端同步</h3>
        <p class="description">
          {{ isAuthenticated ? '您的学习记录已接入 Cloudflare 边缘云端同步，SM-2 记忆算法排程与错题本在手机和电脑间无缝漫游。' : '登录账户即可开启基于 Cloudflare 边缘网络的云端实时同步，学习进度永不丢失。' }}
        </p>

        <div v-if="isAuthenticated" class="account-profile-box">
          <div class="profile-main">
            <div class="profile-avatar">{{ (user?.nickname || user?.email || 'U')[0].toUpperCase() }}</div>
            <div class="profile-details">
              <span class="profile-name">{{ user?.nickname || '学习者' }}</span>
              <span class="profile-email">{{ user?.email }}</span>
            </div>
            <span class="sync-badge" :class="syncStatus">
              {{ syncStatus === 'synced' ? '● 云端已同步' : syncStatus === 'syncing' ? '○ 正在同步' : syncStatus === 'error' ? '▲ 同步失败' : '● 本地存储' }}
            </span>
          </div>
          <div class="account-actions">
            <button class="btn-action mini-action" @click="syncNow">立即同步</button>
            <button class="btn-action mini-action" :disabled="isSendingResetEmail" @click="handleRequestReset">
              {{ isSendingResetEmail ? '正在发送...' : '重置密码' }}
            </button>
            <button class="btn-action mini-action logout-btn" @click="logout">退出登录</button>
          </div>
        </div>

        <div v-else class="account-login-prompt">
          <button @click="emit('open-auth')" class="login-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>登录 / 注册云端同步账号</span>
          </button>
        </div>
      </div>

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

      <!-- Appearance / Theme Preferences -->
      <div class="settings-card glass-card">
        <h3>外观与主题</h3>
        <p class="description">根据您的学习环境与习惯自由选择深浅色视觉风格，移动端与桌面端全局生效。</p>
        
        <div class="theme-options-grid">
          <button
            class="theme-btn"
            :class="{ active: currentTheme === 'system' }"
            @click="setTheme('system')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <span>跟随系统</span>
          </button>

          <button
            class="theme-btn"
            :class="{ active: currentTheme === 'light' }"
            @click="setTheme('light')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span>日间浅色</span>
          </button>

          <button
            class="theme-btn"
            :class="{ active: currentTheme === 'dark' }"
            @click="setTheme('dark')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>深夜暗色</span>
          </button>
        </div>
      </div>

      <!-- Sync / Backup Section -->
      <div class="settings-card glass-card">
        <h3>数据备份与迁移</h3>
        <p class="description">
          {{ isAuthenticated ? '您已开启云端多端同步，但仍可随时将本地记录导出为 JSON 文件进行离线冷备份或迁移。' : '当前处于本地离线存储模式，所有数据保存在本地浏览器中。建议定期导出备份或登录开启云端漫游。' }}
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
          重置进度将会清除您的所有学习历史日志，并将错题本和熟记词汇的状态复原。{{ isAuthenticated ? '已登录状态下将同步清空云端备份数据库。' : '' }}此操作不可撤销，请谨慎操作。
        </p>
        
        <button @click="handleResetAll" class="btn-danger">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          完全重置所有数据{{ isAuthenticated ? ' (含云端)' : '' }}
        </button>
      </div>

      <!-- About Info -->
      <div class="settings-card glass-card about-card">
        <h3>关于 NuanceTEM</h3>
        <p class="description">
          NuanceTEM 是一款专为 TEM-4（英语专业四级）与 TEM-8（英语专业八级）备考设计的近义词辨析学习系统。采用 SM-2 智能记忆曲线与极简自适应界面设计，助力英专学子攻克细微语境词义辨析难关。
        </p>
        <div class="version-info">
          <p>
            当前运行模式:
            <span class="runtime-badge" :class="isAuthenticated ? 'cloud' : 'local'">
              {{ isAuthenticated ? '云端漫游同步已连接' : '本地离线运行模式' }}
            </span>
          </p>
          <p>软件版本: <strong>v{{ appVersion }}</strong></p>
          <p v-if="isAuthenticated">
            登录云端账号: <strong>{{ user?.nickname || '学习者' }} ({{ user?.email }})</strong>
          </p>
          <p v-else>
            云端连接状态: <span class="dim-text">未登录（数据仅存本地浏览器）</span>
          </p>
          <p>存储引擎: <strong>IndexedDB (Dexie.js 本地引擎){{ isAuthenticated ? ' + Cloudflare D1 (云端分布式数据库)' : '' }}</strong></p>
          <p>软件架构: <strong>Vite + Vue 3 + Cloudflare Pages &amp; Edge Functions</strong></p>
          <p>题库更新时间: <strong>{{ dbUpdateTime }}</strong></p>
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

.theme-options-grid {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  flex-wrap: wrap;
}

.theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-btn:hover {
  border-color: var(--primary);
  color: var(--text-main);
  background-color: var(--bg-card-hover);
}

.theme-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: var(--primary);
  box-shadow: 0 2px 10px var(--primary-light);
}

/* Account & Sync Section */
.account-card {
  width: 100%;
}

.account-profile-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
}

.profile-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.profile-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--text-on-primary);
  font-weight: 700;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-details {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 160px;
}

.profile-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-main);
}

.profile-email {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.sync-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  background: var(--bg-app);
}
.sync-badge.synced { color: var(--success); }
.sync-badge.syncing { color: var(--primary); }
.sync-badge.error { color: var(--error); }
.sync-badge.idle { color: var(--text-muted); }

.account-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.mini-action {
  padding: 0.4rem 0.85rem;
  font-size: 0.8rem;
}

.logout-btn:hover {
  color: var(--error);
  border-color: var(--error);
}

.runtime-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}
.runtime-badge.cloud {
  background: var(--primary-light);
  color: var(--primary);
}
.runtime-badge.local {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-muted);
}
.dim-text {
  color: var(--text-muted);
}
</style>
