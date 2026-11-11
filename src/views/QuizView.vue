<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { db, type Question, type Progress, recordAttempt, toggleMastered, createDefaultProgress, TAXONOMY_MECHANISMS } from '../db';
import { useScope, type LevelScope } from '../composables/useScope';
import QuizCard from '../components/QuizCard.vue';
import ExplanationSheet from '../components/ExplanationSheet.vue';

const { currentScope, setScope } = useScope();

const currentQuestion = ref<Question | null>(null);
const currentProgress = ref<Progress | null>(null);
const userChoice = ref('');
const isAnswered = ref(false);
const isCorrect = ref(false);
const showExplanation = ref(false);

const recentQuestionIds = ref<string[]>([]);
const currentMechFilter = ref<string>(localStorage.getItem('nuancetem_quiz_mech') || 'ALL');

const isCategoryEmpty = ref(false);

const changeLevel = (lvl: LevelScope) => {
  if (currentScope.value === lvl) {
    recentQuestionIds.value = [];
    loadNextQuestion();
  } else {
    setScope(lvl); // 触发 watch(currentScope)
  }
};

watch(currentScope, () => {
  recentQuestionIds.value = [];
  loadNextQuestion();
});

const changeMech = (mech: string) => {
  currentMechFilter.value = mech;
  localStorage.setItem('nuancetem_quiz_mech', mech);
  recentQuestionIds.value = [];
  loadNextQuestion();
};

const loadNextQuestion = async () => {
  // Reset state
  userChoice.value = '';
  isAnswered.value = false;
  isCorrect.value = false;
  showExplanation.value = false;

  // 1. 获取已熟记题目集合
  const masteredIds = new Set(
    (await db.progress.where('status').equals('mastered').toArray()).map(p => p.questionId)
  );

  // 2. 利用 Dexie 索引定位题目，避免全表扫描
  let availableQuestions: Question[] = [];
  let totalInCategory = 0;

  if (currentScope.value !== 'ALL' && currentMechFilter.value !== 'ALL') {
    const questions = await db.questions
      .where('level').equals(currentScope.value)
      .filter(q => q.mechanism === currentMechFilter.value)
      .toArray();
    totalInCategory = questions.length;
    availableQuestions = questions.filter(q => !masteredIds.has(q.id));
  } else if (currentScope.value !== 'ALL') {
    const questions = await db.questions
      .where('level').equals(currentScope.value)
      .toArray();
    totalInCategory = questions.length;
    availableQuestions = questions.filter(q => !masteredIds.has(q.id));
  } else if (currentMechFilter.value !== 'ALL') {
    const questions = await db.questions
      .where('mechanism').equals(currentMechFilter.value)
      .toArray();
    totalInCategory = questions.length;
    availableQuestions = questions.filter(q => !masteredIds.has(q.id));
  } else {
    totalInCategory = await db.questions.count();
    availableQuestions = await db.questions.filter(q => !masteredIds.has(q.id)).toArray();
  }

  isCategoryEmpty.value = totalInCategory === 0;

  if (availableQuestions.length === 0) {
    currentQuestion.value = null;
    return;
  }

  // Filter out recently asked questions to avoid immediate repetition
  let candidates = availableQuestions.filter(q => !recentQuestionIds.value.includes(q.id));
  if (candidates.length === 0) {
    recentQuestionIds.value = [];
    candidates = availableQuestions;
  }

  // Pick a random question
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selected = candidates[randomIndex];
  currentQuestion.value = selected;

  // Update history
  recentQuestionIds.value.push(selected.id);
  if (recentQuestionIds.value.length > 20) {
    recentQuestionIds.value.shift();
  }

  // Load progress
  let progress = await db.progress.get(selected.id);
  if (!progress) {
    progress = createDefaultProgress(selected.id);
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
      <div class="title-row">
        <div>
          <h2>每日词辨挑战</h2>
          <p>自动挑选未熟记的题目，点击选项答题并评估掌握程度。</p>
        </div>
        <div class="level-tabs">
          <button 
            v-for="lvl in ['ALL', 'TEM-4', 'TEM-8']" 
            :key="lvl"
            class="level-tab-btn" 
            :class="{ active: currentScope === lvl }"
            @click="changeLevel(lvl as LevelScope)"
          >
            {{ lvl === 'ALL' ? '综合' : lvl }}
          </button>
        </div>
      </div>

      <!-- 考点机制专项突破栏 -->
      <div class="mech-tabs-bar">
        <span class="mech-tabs-label">专项突破：</span>
        <div class="mech-tabs">
          <button 
            class="mech-tab-btn"
            :class="{ active: currentMechFilter === 'ALL' }"
            @click="changeMech('ALL')"
          >全部考点</button>
          <button 
            v-for="(v, k) in TAXONOMY_MECHANISMS" 
            :key="k"
            class="mech-tab-btn"
            :class="{ active: currentMechFilter === k }"
            @click="changeMech(k)"
          >{{ v.label }}</button>
        </div>
      </div>
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
        :taxonomyNotes="currentQuestion.taxonomy_notes"
        :mechanism="currentQuestion.mechanism"
        @next="loadNextQuestion"
        @toggleMaster="handleToggleMaster"
        @rateDifficulty="handleRateDifficulty"
      />
    </div>

    <div v-else class="empty-state glass-card">
      <template v-if="isCategoryEmpty">
        <div class="icon">📂</div>
        <h3>当前考点暂未收录题目</h3>
        <p>该分类题库正在整理扩充中，您可以切换其他考点或学段继续挑战！</p>
      </template>
      <template v-else>
        <div class="icon">🏆</div>
        <h3>太棒了！该分类下题目均已熟记</h3>
        <p>您可以前往“智能复习”巩固记忆，或在“词库浏览器”中重置部分熟记词汇的进度。</p>
      </template>
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

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.level-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.4);
  padding: 0.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  gap: 0.25rem;
}
[data-theme="dark"] .level-tabs {
  background: rgba(15, 23, 42, 0.5);
}

.level-tab-btn {
  padding: 0.5rem 0.9rem;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.level-tab-btn:hover {
  color: var(--text-main);
}
.level-tab-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
  font-weight: 700;
  box-shadow: 0 2px 8px var(--primary-light);
}

.mech-tabs-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.85rem;
  flex-wrap: wrap;
}

.mech-tabs-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}

.mech-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.4);
  padding: 0.2rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  gap: 0.25rem;
  flex-wrap: wrap;
}
[data-theme="dark"] .mech-tabs {
  background: rgba(15, 23, 42, 0.5);
}

.mech-tab-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.mech-tab-btn:hover {
  color: var(--text-main);
}
.mech-tab-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
  font-weight: 700;
  box-shadow: 0 2px 8px var(--primary-light);
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
