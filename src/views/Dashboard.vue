<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../db';

const emit = defineEmits<{
  (e: 'navigate', view: string): void;
}>();

const totalQuestions = ref(0);
const masteredCount = ref(0);
const learningCount = ref(0);
const newCount = ref(0);
const dueCount = ref(0);
const completedToday = ref(0);
const dailyTarget = ref(Number(localStorage.getItem('dailyTarget')) || 20);

const loadStats = async () => {
  dailyTarget.value = Number(localStorage.getItem('dailyTarget')) || 20;
  totalQuestions.value = await db.questions.count();
  
  // Count mastered
  masteredCount.value = await db.progress.where('status').equals('mastered').count();
  
  // Count learning
  learningCount.value = await db.progress.where('status').equals('learning').count();
  
  // Count new
  newCount.value = await db.progress.where('status').equals('new').count();
  
  // Count due for review (status is learning and nextReview <= now)
  const now = Date.now();
  dueCount.value = await db.progress
    .where('status')
    .equals('learning')
    .filter(p => p.nextReview <= now)
    .count();

  // Count completed today (logs where timestamp is within today)
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  completedToday.value = await db.logs
    .where('timestamp')
    .aboveOrEqual(startOfToday)
    .count();
};

onMounted(loadStats);
</script>

<template>
  <div class="dashboard slide-up">
    <!-- Header Hero -->
    <div class="hero-section">
      <div class="hero-text">
        <h1>Welcome to NuanceTEM</h1>
        <p>精琢词义辨析，拿下专四专八。今天也要坚持打卡哦！</p>
      </div>
      <div class="hero-progress-circle">
        <svg viewBox="0 0 36 36" class="circular-chart">
          <path class="circle-bg"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path class="circle"
            :stroke-dasharray="`${Math.min(100, Math.round((completedToday / dailyTarget) * 100))}, 100`"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <text x="18" y="20.35" class="percentage">{{ Math.min(100, Math.round((completedToday / dailyTarget) * 100)) }}%</text>
        </svg>
        <div class="circle-label">
          <span class="count">{{ completedToday }}/{{ dailyTarget }}</span>
          <span>今日目标</span>
        </div>
      </div>
    </div>

    <!-- Quick Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card glass-card">
        <div class="stat-icon due">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ dueCount }}</h3>
          <p>今日待复习</p>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon mastered">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ masteredCount }}</h3>
          <p>已熟记词汇</p>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon learning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ learningCount }}</h3>
          <p>记忆曲线中</p>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon total">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <div class="stat-info">
          <h3>{{ totalQuestions }}</h3>
          <p>总词组题量</p>
        </div>
      </div>
    </div>

    <!-- Actions Section -->
    <div class="action-section">
      <div class="action-card glass-card study-card">
        <h2>开始学习</h2>
        <p>随机挑战词汇近义词辨析题，自动过滤您已经完全熟记的题目。</p>
        <button @click="emit('navigate', 'quiz')" class="btn-primary">
          立即开始
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" class="arrow">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      <div class="action-card glass-card review-card">
        <h2>智能复习</h2>
        <p>根据您的记忆曲线（SM-2 算法），系统已经自动挑选出最适合今天复习的错题。</p>
        <button @click="emit('navigate', 'review')" class="btn-primary" :disabled="dueCount === 0" :class="{ disabled: dueCount === 0 }">
          {{ dueCount > 0 ? '开始复习' : '今日复习已完成' }}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" class="arrow">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.hero-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, var(--primary-light), rgba(255, 255, 255, 0.4));
  border: 1px solid var(--glass-border);
  padding: 2.5rem;
  border-radius: var(--radius-lg);
  gap: 2rem;
  box-shadow: var(--shadow-sm);
}

[data-theme="dark"] .hero-section {
  background: linear-gradient(135deg, var(--primary-light), rgba(15, 23, 42, 0.2));
}

@media (max-width: 640px) {
  .hero-section {
    flex-direction: column;
    text-align: center;
    padding: 2rem 1.5rem;
  }
}

.hero-text h1 {
  font-size: clamp(2rem, 6vw, 3rem);
  margin-bottom: 0.75rem;
  background: linear-gradient(135deg, var(--text-main) 20%, var(--primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.hero-text p {
  font-size: clamp(1rem, 3vw, 1.15rem);
  color: var(--text-muted);
}

.hero-progress-circle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.circular-chart {
  width: 90px;
  height: 90px;
}

.circle-bg {
  fill: none;
  stroke: var(--border-color);
  stroke-width: 2.8;
}

.circle {
  fill: none;
  stroke: var(--primary);
  stroke-width: 2.8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease;
}

.percentage {
  fill: var(--text-main);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.55rem;
  text-anchor: middle;
}

.circle-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.circle-label .count {
  font-weight: 700;
  color: var(--text-main);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-icon.due { background-color: var(--warning-light); color: var(--warning); }
.stat-icon.mastered { background-color: var(--success-light); color: var(--success); }
.stat-icon.learning { background-color: var(--info-light); color: var(--info); }
.stat-icon.total { background-color: var(--primary-light); color: var(--primary); }

.stat-info h3 {
  font-size: 1.85rem;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.stat-info p {
  font-size: 0.85rem;
}

.action-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .action-section {
    grid-template-columns: 1fr 1fr;
  }
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
}

.action-card h2 {
  font-size: 1.5rem;
}

.action-card p {
  flex: 1;
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

.btn-primary .arrow {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

.btn-primary:hover .arrow {
  transform: translateX(4px);
}

.btn-primary.disabled {
  background: var(--border-color);
  color: var(--text-muted);
  box-shadow: none;
  cursor: not-allowed;
}

.btn-primary.disabled:hover {
  transform: none;
  box-shadow: none;
}

.btn-primary.disabled .arrow {
  display: none;
}
</style>
