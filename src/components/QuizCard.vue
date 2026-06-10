<script setup lang="ts">
import { computed } from 'vue';
import type { Question } from '../db';

const props = defineProps<{
  question: Question;
  userChoice: string;
  isAnswered: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', option: string): void;
}>();

// Replace ___ in question text with a styled blank element
const formattedQuestion = computed(() => {
  const blankHtml = `<span class="blank-indicator ${props.isAnswered ? 'answered' : ''}">${props.isAnswered ? props.question.answer : ' &nbsp; &nbsp; &nbsp; &nbsp; '}</span>`;
  return props.question.question.replace('___', blankHtml);
});

const getOptionClass = (option: string) => {
  if (!props.isAnswered) {
    return props.userChoice === option ? 'selected' : '';
  }
  
  if (option === props.question.answer) {
    return 'correct';
  }
  
  if (props.userChoice === option && option !== props.question.answer) {
    return 'incorrect';
  }
  
  return 'disabled';
};
</script>

<template>
  <div class="quiz-card glass-card">
    <div class="card-meta">
      <span class="badge badge-primary">{{ question.level }}</span>
      <span class="group-label">辨析组：{{ question.group_name }}</span>
    </div>

    <!-- Render formatted sentence with custom blank space styling -->
    <div class="question-text" v-html="formattedQuestion"></div>

    <div class="options-grid" :class="{ answered: isAnswered }">
      <button
        v-for="(option, index) in question.options"
        :key="option"
        @click="!isAnswered && emit('select', option)"
        :disabled="isAnswered"
        class="option-btn"
        :class="getOptionClass(option)"
      >
        <span class="option-index">{{ String.fromCharCode(65 + index) }}</span>
        <span class="option-word">{{ option }}</span>
        
        <!-- Icon indicating correct/incorrect state -->
        <span class="state-icon" v-if="isAnswered">
          <svg v-if="option === question.answer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <svg v-else-if="userChoice === option" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="cross">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quiz-card {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.group-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
  font-family: var(--font-display);
}

.question-text {
  font-size: 1.35rem;
  line-height: 1.8;
  color: var(--text-main);
  font-weight: 500;
}

:deep(.blank-indicator) {
  display: inline-block;
  min-width: 90px;
  border-bottom: 2px solid var(--text-muted);
  text-align: center;
  margin: 0 0.5rem;
  font-weight: 700;
  color: var(--primary);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 0 0.25rem;
}

:deep(.blank-indicator.answered) {
  border-bottom-color: var(--primary);
  color: var(--primary);
  transform: scale(1.05);
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  /* Side-by-side grids if there are 2 or 4 options */
  .options-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}

.option-btn {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  text-align: left;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.option-btn:not(:disabled):hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  background-color: var(--bg-card-hover);
  box-shadow: var(--shadow-md);
}

.option-btn:not(:disabled):active {
  transform: translateY(0);
}

.option-index {
  font-family: var(--font-display);
  font-weight: 700;
  background-color: var(--primary-light);
  color: var(--primary);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  margin-right: 1rem;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.option-btn:hover .option-index {
  background-color: var(--primary);
  color: white;
}

.option-word {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 1.15rem;
  color: var(--text-main);
  flex: 1;
}

/* Response states styling */
.option-btn.selected {
  border-color: var(--primary);
  background-color: var(--primary-light);
}

.option-btn.correct {
  border-color: var(--success);
  background-color: var(--success-light);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.05);
}

.option-btn.correct .option-index {
  background-color: var(--success);
  color: white;
}

.option-btn.correct .option-word {
  color: var(--success);
  font-weight: 700;
}

.option-btn.incorrect {
  border-color: var(--error);
  background-color: var(--error-light);
}

.option-btn.incorrect .option-index {
  background-color: var(--error);
  color: white;
}

.option-btn.incorrect .option-word {
  color: var(--error);
  font-weight: 700;
}

.option-btn.disabled {
  opacity: 0.6;
  cursor: default;
}

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.state-icon svg {
  width: 100%;
  height: 100%;
}

.state-icon svg.check {
  color: var(--success);
}

.state-icon svg.cross {
  color: var(--error);
}
</style>
