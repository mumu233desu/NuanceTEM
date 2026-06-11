<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type Question, type Progress, recordAttempt, toggleMastered } from '../db';
import QuizCard from '../components/QuizCard.vue';
import ExplanationSheet from '../components/ExplanationSheet.vue';

const dueQuestions = ref<Question[]>([]);
const currentQuestion = ref<Question | null>(null);
const currentProgress = ref<Progress | null>(null);
const currentIndex = ref(0);
const userChoice = ref('');
const isAnswered = ref(false);
const isCorrect = ref(false);
const showExplanation = ref(false);
const isLoading = ref(true);

const forecast = ref<{ dayStr: string, count: number }[]>([]);

const loadForecast = async () => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  
  const learningProgress = await db.progress
    .where('status')
    .equals('learning')
    .filter(p => p.nextReview > now)
    .toArray();
    
  const counts = [0, 0, 0, 0, 0];
  
  learningProgress.forEach(p => {
    const daysAhead = Math.floor((p.nextReview - startOfToday) / oneDay);
    if (daysAhead >= 1 && daysAhead <= 5) {
      counts[daysAhead - 1]++;
    }
  });
  
  const labels = ['明天', '后天', '大后天', '4天后', '5天后'];
  forecast.value = counts.map((count, i) => ({
    dayStr: labels[i],
    count
  }));
};

const loadDueQuestions = async () => {
  isLoading.value = true;
  const now = Date.now();
  
  // Find progress entries that are due
  const dueProgress = await db.progress
    .where('status')
    .equals('learning')
    .filter(p => p.nextReview <= now)
    .toArray();

  if (dueProgress.length === 0) {
    dueQuestions.value = [];
    currentQuestion.value = null;
    await loadForecast();
    isLoading.value = false;
    return;
  }

  // Map progress entries to questions
  const dueIds = new Set(dueProgress.map(p => p.questionId));
  const allQuestions = await db.questions.toArray();
  
  // Keep the order defined by nextReview ascending (older reviews first)
  const idToProgressMap = new Map(dueProgress.map(p => [p.questionId, p]));
  
  dueQuestions.value = allQuestions
    .filter(q => dueIds.has(q.id))
    .sort((a, b) => {
      const nextA = idToProgressMap.get(a.id)?.nextReview ?? 0;
      const nextB = idToProgressMap.get(b.id)?.nextReview ?? 0;
      return nextA - nextB;
    });

  currentIndex.value = 0;
  setCurrentQuestion();
  isLoading.value = false;
};

const setCurrentQuestion = async () => {
  if (dueQuestions.value.length === 0 || currentIndex.value >= dueQuestions.value.length) {
    currentQuestion.value = null;
    await loadForecast();
    return;
  }

  const selected = dueQuestions.value[currentIndex.value];
  currentQuestion.value = selected;

  // Load progress
  const progress = await db.progress.get(selected.id);
  currentProgress.value = progress || null;

  // Reset answer states
  userChoice.value = '';
  isAnswered.value = false;
  isCorrect.value = false;
  showExplanation.value = false;
};

const handleSelect = (option: string) => {
  if (isAnswered.value) return;
  
  userChoice.value = option;
  isAnswered.value = true;
  isCorrect.value = option === currentQuestion.value?.answer;
  showExplanation.value = true;
};

const handleToggleMaster = async () => {
  if (!currentQuestion.value || !currentProgress.value) return;
  
  const nextVal = currentProgress.value.status !== 'mastered';
  await toggleMastered(currentQuestion.value.id, nextVal);
  
  // Reload local progress state
  const updated = await db.progress.get(currentQuestion.value.id);
  if (updated) {
    currentProgress.value = updated;
  }
};

const handleRateDifficulty = async (quality: number) => {
  if (!currentQuestion.value) return;
  
  // Update progress using SM-2
  await recordAttempt(
    currentQuestion.value.id,
    userChoice.value,
    isCorrect.value,
    quality
  );

  // If answer was wrong (quality == 0), move it to the end of the current session queue to re-test
  if (quality < 3) {
    const wrongQuestion = dueQuestions.value[currentIndex.value];
    dueQuestions.value.push(wrongQuestion);
  }

  currentIndex.value++;
  await setCurrentQuestion();
};

onMounted(loadDueQuestions);
</script>

<template>
  <div class="review-view slide-up">
    <div class="header">
      <h2>Spaced Repetition 复习面板</h2>
      <p v-if="dueQuestions.length > 0">
        今天共有 <span class="highlight">{{ Math.max(0, dueQuestions.length - currentIndex) }}</span> 道错题/到期题目需要复习。
      </p>
    </div>

    <div v-if="isLoading" class="loading-state glass-card">
      <div class="spinner"></div>
      <p>正在拉取需要复习的到期错题...</p>
    </div>

    <div v-else-if="currentQuestion" class="quiz-container">
      <div class="progress-bar-container">
        <div class="progress-bar" :style="{ width: `${(currentIndex / dueQuestions.length) * 100}%` }"></div>
      </div>

      <QuizCard
        :question="currentQuestion"
        :userChoice="userChoice"
        :isAnswered="isAnswered"
        @select="handleSelect"
      />

      <ExplanationSheet
        :visible="showExplanation"
        :isCorrect="isCorrect"
        :answer="currentQuestion.answer"
        :userChoice="userChoice"
        :translation="currentQuestion.translation"
        :analysis="currentQuestion.distractor_analysis"
        :isMastered="currentProgress?.status === 'mastered'"
        :questionText="currentQuestion.question"
        :optionsList="currentQuestion.options"
        @next="setCurrentQuestion"
        @toggleMaster="handleToggleMaster"
        @rateDifficulty="handleRateDifficulty"
      />
    </div>

    <div v-else class="empty-state glass-card">
      <div class="icon">✨</div>
      <h3>干得漂亮！今日复习计划已全部完成</h3>
      <p>暂时没有更多的到期复习题目了。您可以去“词汇挑战”做一些新题目，它们会自动计入后续的复习曲线中。</p>

      <div class="forecast-container" v-if="forecast.length > 0">
        <h4>近期复习预告</h4>
        <div class="forecast-grid">
          <div class="forecast-card" v-for="item in forecast" :key="item.dayStr" :class="{ 'has-reviews': item.count > 0 }">
            <span class="day">{{ item.dayStr }}</span>
            <span class="count">{{ item.count }} 题</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.header {
  margin-bottom: 0.5rem;
}

.highlight {
  font-weight: 700;
  color: var(--primary);
  font-size: 1.15rem;
}

.quiz-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background-color: var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-bar {
  height: 100%;
  background-color: var(--primary);
  border-radius: var(--radius-sm);
  transition: width 0.3s ease;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-state .icon {
  font-size: 4rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  margin-top: 0.5rem;
}

.forecast-container {
  width: 100%;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px dashed var(--border-color);
}

.forecast-container h4 {
  font-size: 1.1rem;
  color: var(--text-main);
  margin-bottom: 1rem;
}

.forecast-grid {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.forecast-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  min-width: 80px;
}

.forecast-card.has-reviews {
  border-color: var(--primary-light);
  background: linear-gradient(to bottom, var(--bg-app), var(--primary-light));
}

.forecast-card .day {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.forecast-card .count {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-muted);
}

.forecast-card.has-reviews .count {
  color: var(--primary);
}
</style>
