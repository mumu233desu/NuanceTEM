<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { loadQuestionsFromManifest } from './db/loader';
import Dashboard from './views/Dashboard.vue';
import QuizView from './views/QuizView.vue';
import ReviewView from './views/ReviewView.vue';
import DatabaseView from './views/DatabaseView.vue';
import SettingsView from './views/SettingsView.vue';
import AuthModal from './components/AuthModal.vue';
import { useAuth } from './composables/useAuth';
import { useSync } from './composables/useSync';
import { useScope } from './composables/useScope';

const { user, isAuthenticated, logout, refreshProfile } = useAuth();
const { status: syncStatus, syncNow } = useSync();
const { currentScope } = useScope();

const isAuthModalOpen = ref(false);
const authModalMode = ref<'login' | 'register' | 'forgot' | 'reset'>('login');
const authResetToken = ref('');
const currentView = ref('dashboard');
const isDbInitializing = ref(true);
const isDarkMode = ref(false);

const openAuthModal = (mode: 'login' | 'register' = 'login') => {
  authModalMode.value = mode;
  authResetToken.value = '';
  isAuthModalOpen.value = true;
};

const checkResetPasswordHash = () => {
  const hash = window.location.hash;
  const url = new URL(window.location.href);
  let token = url.searchParams.get('token');

  if (hash.startsWith('#reset-password') || hash.includes('reset-password')) {
    if (!token && hash.includes('token=')) {
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(hash.slice(qIndex + 1));
        token = params.get('token');
      }
    }
    if (token) {
      authResetToken.value = token;
      authModalMode.value = 'reset';
      isAuthModalOpen.value = true;
    }
  }
};

const applyTheme = (isDark: boolean) => {
  isDarkMode.value = isDark;
  const theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.setAttribute('content', isDark ? '#090e1a' : '#fcfaf7');
};

const checkTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    applyTheme(true);
  } else if (savedTheme === 'light') {
    applyTheme(false);
  } else {
    // System preferences (default when no preference or 'system')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  }
};

const toggleTheme = () => {
  const nextIsDark = !isDarkMode.value;
  applyTheme(nextIsDark);
  const nextTheme = nextIsDark ? 'dark' : 'light';
  localStorage.setItem('theme', nextTheme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: nextTheme }));
};

const initApp = async () => {
  checkTheme();
  checkResetPasswordHash();
  window.addEventListener('hashchange', checkResetPasswordHash);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme || savedTheme === 'system') {
      applyTheme(e.matches);
    }
  };
  mediaQuery.addEventListener('change', handleSystemThemeChange);

  window.addEventListener('theme-changed', (() => {
    checkTheme();
  }) as EventListener);
  
  try {
    console.log('Loading modular questions via Manifest packages...');
    await loadQuestionsFromManifest();
  } catch (err) {
    console.error('Failed to initialize local question database:', err);
  } finally {
    isDbInitializing.value = false;
    // 异步尝试同步云端
    refreshProfile().then(() => syncNow());
  }
};

const navigateTo = (view: string) => {
  currentView.value = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

onMounted(initApp);
</script>

<template>
  <div class="app-container">
    <!-- Desktop Sidebar -->
    <aside class="sidebar">
      <div class="logo-section">
        <div class="logo-icon">豆</div>
        <div class="logo-titles">
          <div class="logo-text">豆英语</div>
          <div class="logo-sub">NuanceTEM · {{ currentScope === 'ALL' ? '综合' : currentScope }}</div>
        </div>
      </div>

      <nav class="nav-links" aria-label="主导航">
        <button
          type="button"
          @click="navigateTo('dashboard')"
          class="nav-item"
          :class="{ active: currentView === 'dashboard' }"
          :aria-current="currentView === 'dashboard' ? 'page' : undefined"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          仪表盘
        </button>
        
        <button
          type="button"
          @click="navigateTo('quiz')"
          class="nav-item"
          :class="{ active: currentView === 'quiz' }"
          :aria-current="currentView === 'quiz' ? 'page' : undefined"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          词汇挑战
        </button>

        <button
          type="button"
          @click="navigateTo('review')"
          class="nav-item"
          :class="{ active: currentView === 'review' }"
          :aria-current="currentView === 'review' ? 'page' : undefined"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
          </svg>
          智能复习
        </button>

        <button
          type="button"
          @click="navigateTo('database')"
          class="nav-item"
          :class="{ active: currentView === 'database' }"
          :aria-current="currentView === 'database' ? 'page' : undefined"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            <path d="M12 16v-4M12 8h.01"></path>
          </svg>
          词库浏览
        </button>

        <button
          type="button"
          @click="navigateTo('settings')"
          class="nav-item"
          :class="{ active: currentView === 'settings' }"
          :aria-current="currentView === 'settings' ? 'page' : undefined"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          设置
        </button>
      </nav>

      <!-- Cloud Sync & Account in Sidebar -->
      <div class="sidebar-account-section">
        <div v-if="isAuthenticated" class="user-card glass-card">
          <div class="user-info">
            <span class="user-name">{{ user?.nickname || '学习者' }}</span>
            <span class="user-email">{{ user?.email }}</span>
          </div>
          <div class="sync-status-row">
            <span class="sync-indicator" :class="syncStatus">
              {{ syncStatus === 'synced' ? '● 云端同步' : syncStatus === 'syncing' ? '○ 正在同步' : syncStatus === 'error' ? '▲ 同步失败' : '● 本地存储' }}
            </span>
            <button class="mini-btn" @click="syncNow" title="立即同步">同步</button>
            <button class="mini-btn logout" @click="logout" title="退出登录">退出</button>
          </div>
        </div>
        <div v-else class="login-prompt">
          <button @click="openAuthModal('login')" class="login-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>登录云端同步</span>
          </button>
        </div>
      </div>

      <!-- Theme Toggle in Sidebar -->
      <div class="theme-toggle-container">
        <button type="button" @click="toggleTheme" class="nav-item">
          <svg v-if="isDarkMode" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
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
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          {{ isDarkMode ? '日间模式' : '夜间模式' }}
        </button>
      </div>
    </aside>

    <!-- Mobile Navigation Bar -->
    <nav class="mobile-nav" aria-label="移动端底部导航">
      <button
        type="button"
        @click="navigateTo('dashboard')"
        class="mobile-nav-item"
        :class="{ active: currentView === 'dashboard' }"
        :aria-current="currentView === 'dashboard' ? 'page' : undefined"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>仪表盘</span>
      </button>
      <button
        type="button"
        @click="navigateTo('quiz')"
        class="mobile-nav-item"
        :class="{ active: currentView === 'quiz' }"
        :aria-current="currentView === 'quiz' ? 'page' : undefined"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <span>词汇挑战</span>
      </button>
      <button
        type="button"
        @click="navigateTo('review')"
        class="mobile-nav-item"
        :class="{ active: currentView === 'review' }"
        :aria-current="currentView === 'review' ? 'page' : undefined"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
        </svg>
        <span>智能复习</span>
      </button>
      <button
        type="button"
        @click="navigateTo('database')"
        class="mobile-nav-item"
        :class="{ active: currentView === 'database' }"
        :aria-current="currentView === 'database' ? 'page' : undefined"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
          <path d="M12 16v-4M12 8h.01"></path>
        </svg>
        <span>词库</span>
      </button>
      <button
        type="button"
        @click="navigateTo('settings')"
        class="mobile-nav-item"
        :class="{ active: currentView === 'settings' }"
        :aria-current="currentView === 'settings' ? 'page' : undefined"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>设置</span>
      </button>
    </nav>

    <!-- Main Content Panel -->
    <main class="main-content">
      <div v-if="isDbInitializing" class="loading-screen scale-in">
        <div class="logo-icon animate-pulse">N</div>
        <h2>NuanceTEM</h2>
        <p>正在拉取词库并建立本地索引，请稍候...</p>
        <div class="loader"></div>
      </div>

      <template v-else>
        <Dashboard v-if="currentView === 'dashboard'" @navigate="navigateTo" />
        <QuizView v-if="currentView === 'quiz'" />
        <ReviewView v-if="currentView === 'review'" />
        <DatabaseView v-if="currentView === 'database'" />
        <SettingsView v-if="currentView === 'settings'" @open-auth="openAuthModal('login')" />
      </template>
    </main>

    <!-- Cloud Auth Modal -->
    <AuthModal
      :isOpen="isAuthModalOpen"
      :initialMode="authModalMode"
      :initialToken="authResetToken"
      @close="isAuthModalOpen = false"
    />
  </div>
</template>

<style>
/* Logo Titles */
.logo-titles {
  display: flex;
  flex-direction: column;
}
.logo-titles .logo-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0.05em;
  margin-top: -2px;
}

/* Sidebar Account & Sync Section */
.sidebar-account-section {
  margin-top: auto;
  padding: 0 0.5rem;
  margin-bottom: 0.75rem;
}

.login-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgba(15, 118, 110, 0.35);
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
}
.login-btn:hover {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(15, 118, 110, 0.2);
}

[data-theme="dark"] .login-btn {
  background: rgba(45, 212, 191, 0.12);
  border-color: rgba(45, 212, 191, 0.4);
  color: #2dd4bf;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
[data-theme="dark"] .login-btn:hover {
  background: #2dd4bf;
  color: #042f2e;
  border-color: #2dd4bf;
  box-shadow: 0 4px 16px rgba(45, 212, 191, 0.3);
}

.user-card {
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: var(--radius-md);
}

.user-info {
  display: flex;
  flex-direction: column;
}
.user-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-main);
}
.user-email {
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-color);
}

.sync-indicator {
  font-size: 0.72rem;
  font-weight: 600;
}
.sync-indicator.synced { color: var(--success); }
.sync-indicator.syncing { color: var(--primary); }
.sync-indicator.error { color: var(--error); }
.sync-indicator.idle { color: var(--text-muted); }

.mini-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.mini-btn:hover {
  color: var(--text-main);
  border-color: var(--text-muted);
}
.mini-btn.logout:hover {
  color: var(--error);
  border-color: var(--error);
}

.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1.25rem;
  text-align: center;
}

.loading-screen .logo-icon {
  width: 60px;
  height: 60px;
  font-size: 2rem;
  border-radius: var(--radius-md);
  margin-bottom: 0.5rem;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .7; transform: scale(0.96); }
}

.loader {
  width: 40px;
  height: 4px;
  background-color: var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  position: relative;
}

.loader::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 50%;
  background: var(--primary);
  border-radius: var(--radius-sm);
  animation: loading 1.5s ease-in-out infinite;
}

@keyframes loading {
  0% { left: -50%; }
  100% { left: 100%; }
}
</style>
