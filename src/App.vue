<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, initializeDatabase } from './db';
import Dashboard from './views/Dashboard.vue';
import QuizView from './views/QuizView.vue';
import ReviewView from './views/ReviewView.vue';
import DatabaseView from './views/DatabaseView.vue';
import SettingsView from './views/SettingsView.vue';

const currentView = ref('dashboard');
const isDbInitializing = ref(true);
const isDarkMode = ref(false);

const checkTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    isDarkMode.value = true;
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (savedTheme === 'light') {
    isDarkMode.value = false;
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    // System preferences
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDarkMode.value = prefersDark;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
};

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  const nextTheme = isDarkMode.value ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
};

const initApp = async () => {
  checkTheme();
  
  try {
    // Check and seed/sync database
    console.log('Fetching static questions database for seed/sync...');
    const response = await fetch('/data/questions.json');
    if (!response.ok) {
      throw new Error('Failed to fetch static questions.json file');
    }
    const questionsData = await response.json();
    await initializeDatabase(questionsData);
  } catch (err) {
    console.error('Failed to initialize local IndexedDB database:', err);
  } finally {
    isDbInitializing.value = false;
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
        <div class="logo-icon">N</div>
        <div class="logo-text">NuanceTEM</div>
      </div>

      <nav class="nav-links">
        <div @click="navigateTo('dashboard')" class="nav-item" :class="{ active: currentView === 'dashboard' }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          仪表盘
        </div>
        
        <div @click="navigateTo('quiz')" class="nav-item" :class="{ active: currentView === 'quiz' }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          词汇挑战
        </div>

        <div @click="navigateTo('review')" class="nav-item" :class="{ active: currentView === 'review' }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
          </svg>
          智能复习
        </div>

        <div @click="navigateTo('database')" class="nav-item" :class="{ active: currentView === 'database' }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            <path d="M12 16v-4M12 8h.01"></path>
          </svg>
          词库浏览
        </div>

        <div @click="navigateTo('settings')" class="nav-item" :class="{ active: currentView === 'settings' }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          设置
        </div>
      </nav>

      <!-- Theme Toggle in Sidebar -->
      <div class="theme-toggle-container">
        <button @click="toggleTheme" class="nav-item">
          <svg v-if="isDarkMode" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
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
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          {{ isDarkMode ? '日间模式' : '夜间模式' }}
        </button>
      </div>
    </aside>

    <!-- Mobile Navigation Bar -->
    <nav class="mobile-nav">
      <div @click="navigateTo('dashboard')" class="mobile-nav-item" :class="{ active: currentView === 'dashboard' }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>仪表盘</span>
      </div>
      <div @click="navigateTo('quiz')" class="mobile-nav-item" :class="{ active: currentView === 'quiz' }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <span>词汇挑战</span>
      </div>
      <div @click="navigateTo('review')" class="mobile-nav-item" :class="{ active: currentView === 'review' }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
        </svg>
        <span>复习</span>
      </div>
      <div @click="navigateTo('database')" class="mobile-nav-item" :class="{ active: currentView === 'database' }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
          <path d="M12 16v-4M12 8h.01"></path>
        </svg>
        <span>词库</span>
      </div>
      <div @click="navigateTo('settings')" class="mobile-nav-item" :class="{ active: currentView === 'settings' }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>设置</span>
      </div>
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
        <SettingsView v-if="currentView === 'settings'" />
      </template>
    </main>
  </div>
</template>

<style>
/* Global stylesheet import (already handled by main.ts, but let's make sure it resets everything) */
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
