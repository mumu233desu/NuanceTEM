<script setup lang="ts">

const props = defineProps<{
  visible: boolean;
  isCorrect: boolean;
  answer: string;
  userChoice: string;
  translation: string;
  analysis: Record<string, string>;
  isMastered: boolean;
  questionText: string;
  optionsList: string[];
}>();

const emit = defineEmits<{
  (e: 'next'): void;
  (e: 'toggleMaster'): void;
  (e: 'rateDifficulty', quality: number): void;
}>();

const copyPrompt = () => {
  const prompt = `我遇到了一道题：${props.questionText}
我选择了：${props.userChoice || '（未选择）'}
正确答案是：${props.answer}
选项有：${props.optionsList.join(', ')}

请详细解释这些选项词汇之间的微妙区别，并说明为什么在这里只能选 ${props.answer} 而不能选 ${props.userChoice}。`;
  
  navigator.clipboard.writeText(prompt).then(() => {
    // Optional: could use a toast here, but alert works for simple use
    alert('Prompt已复制！请直接粘贴给其他大模型以获取深入解析。');
  });
};
</script>

<template>
  <div v-if="visible" class="explanation-sheet scale-in">
    <div class="header">
      <div class="result-badge" :class="isCorrect ? 'correct' : 'incorrect'">
        <span v-if="isCorrect">✓ 答对了</span>
        <span v-else>✗ 答错了（正确答案: <span class="highlight">{{ answer }}</span>）</span>
      </div>
      
      <button @click="emit('toggleMaster')" class="btn-master" :class="{ mastered: isMastered }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-bookmark">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        {{ isMastered ? '已熟记' : '标记熟记' }}
      </button>
    </div>

    <div class="content">
      <div class="section translation-section">
        <h4>译文</h4>
        <p class="translation">{{ translation }}</p>
      </div>

      <div class="section analysis-section">
        <div class="analysis-header">
          <h4>近义词辨析</h4>
          <button class="btn-copy" @click="copyPrompt" title="复制提示词给AI">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            请 AI 深入解析
          </button>
        </div>
        <div class="analysis-list">
          <div v-for="(detail, option) in analysis" :key="option" class="analysis-item" :class="{ 'correct-word': option === answer }">
            <span class="word-badge">{{ option }}</span>
            <p class="word-detail">{{ detail }}</p>
          </div>
        </div>
      </div>
      
      <div class="section rate-section">
        <h4>请评估此题难易度（将影响下次复习时间）</h4>
        <div class="rate-buttons">
          <button @click="emit('rateDifficulty', 5)" class="rate-btn easy">简单 (5)</button>
          <button @click="emit('rateDifficulty', 4)" class="rate-btn medium">适中 (4)</button>
          <button @click="emit('rateDifficulty', 3)" class="rate-btn hard">困难 (3)</button>
          <button @click="emit('rateDifficulty', 0)" class="rate-btn fail">答错 (0)</button>
        </div>
      </div>
    </div>

    <div class="footer">
      <button @click="emit('next')" class="btn-next">
        下一题
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="arrow">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.explanation-sheet {
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  margin-top: 1.5rem;
  box-shadow: var(--shadow-md);
  border-left: 5px solid var(--primary);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.result-badge {
  font-weight: 700;
  font-family: var(--font-display);
  font-size: 1.15rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
}

.result-badge.correct {
  background-color: var(--success-light);
  color: var(--success);
}

.result-badge.incorrect {
  background-color: var(--error-light);
  color: var(--error);
}

.highlight {
  text-decoration: underline;
  margin-left: 0.25rem;
}

.btn-master {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  transition: all 0.2s ease;
}

.btn-master svg {
  width: 16px;
  height: 16px;
}

.btn-master:hover {
  background: var(--primary-light);
  color: var(--primary);
  border-color: var(--primary);
}

.btn-master.mastered {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-master.mastered svg {
  fill: currentColor;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

h4 {
  font-size: 0.85rem;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.translation {
  font-size: 1.05rem;
  color: var(--text-main);
  font-weight: 500;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-light);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.btn-copy svg {
  width: 14px;
  height: 14px;
}

.btn-copy:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.analysis-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.analysis-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.4);
}

[data-theme="dark"] .analysis-item {
  background: rgba(15, 23, 42, 0.2);
}

.analysis-item.correct-word {
  border-color: var(--primary);
  background-color: var(--primary-light);
}

.word-badge {
  font-family: var(--font-sans);
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-light);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  height: fit-content;
  font-size: 0.9rem;
}

.correct-word .word-badge {
  background-color: var(--primary);
  color: white;
}

.word-detail {
  font-size: 0.95rem;
  color: var(--text-main);
  flex: 1;
}

.rate-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.rate-btn {
  padding: 0.65rem;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.rate-btn.easy:hover { background: var(--success-light); color: var(--success); border-color: var(--success); }
.rate-btn.medium:hover { background: var(--info-light); color: var(--info); border-color: var(--info); }
.rate-btn.hard:hover { background: var(--warning-light); color: var(--warning); border-color: var(--warning); }
.rate-btn.fail:hover { background: var(--error-light); color: var(--error); border-color: var(--error); }

.footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-next {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: white;
  padding: 0.85rem 2rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 14px var(--primary-light);
  transition: all 0.2s ease;
}

.btn-next:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--primary-light);
}

.btn-next svg {
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}

.btn-next:hover svg {
  transform: translateX(4px);
}
</style>
