<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type Question, type Progress, recordAttempt, toggleMastered } from '../db';
import QuizCard from '../components/QuizCard.vue';
import ExplanationSheet from '../components/ExplanationSheet.vue';

const currentQuestion = ref<Question | null>(null);
const currentProgress = ref<Progress | null>(null);
const userChoice = ref('');
const isAnswered = ref(false);
const isCorrect = ref(false);
const showExplanation = ref(false);

const loadNextQuestion = async () => {
  // Reset state
  userChoice.value = '';
  isAnswered.value = false;
  isCorrect.value = false;
  showExplanation.value = false;

  // Find all questions that are not mastered
  const masteredIds = new Set(
    (await db.progress.where('status').equals('mastered').toArray()).map(p => p.questionId)
  );

  const allQuestions = await db.questions.toArray();
  const availableQuestions = allQuestions.filter(q => !masteredIds.has(q.id));

  if (availableQuestions.length === 0) {
    currentQuestion.value = null;
    return;
  }

  // Pick a random question
  const randomIndex = Math.floor(Math.random() * availableQuestions.length);
  const selected = availableQuestions[randomIndex];
  currentQuestion.value = selected;

  // Load progress
  let progress = await db.progress.get(selected.id);
  if (!progress) {
    progress = {
      questionId: selected.id,
      status: 'new',
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      nextReview: 0,
      lastAnswered: 0,
    };
  }
  currentProgress.value = progress;
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
  
  // Update SM-2 progress
  await recordAttempt(
    currentQuestion.value.id,
    userChoice.value,
    isCorrect.value,
    quality
  );

  // Load next question
  await loadNextQuestion();
};

onMounted(loadNextQuestion);
</script>

<template>
  <div class="quiz-view slide-up">
    <div class="header">
      <h2>每日词辨挑战</h2>
      <p>自动挑选未熟记的题目，点击选项答题并评估掌握程度。</p>
    </div>

    <div v-if="currentQuestion" class="quiz-container">
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
        @next="loadNextQuestion"
        @toggleMaster="handleToggleMaster"
        @rateDifficulty="handleRateDifficulty"
      />
    </div>

    <div v-else class="empty-state glass-card">
      <div class="icon">🏆</div>
      <h3>太棒了！所有的题目都已被您彻底熟记</h3>
      <p>您可以前往“设置”导入新题库，或在“词库浏览器”中重置部分熟记词汇的进度。</p>
    </div>
  </div>
</template>

<style scoped>
.quiz-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.header {
  margin-bottom: 0.5rem;
}

.quiz-container {
  display: flex;
  flex-direction: column;
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
</style>
