<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, type Question, type Progress, toggleMastered, createDefaultProgress } from '../db';

interface QuestionWithProgress extends Question {
  status: 'new' | 'learning' | 'mastered';
  ease: number;
  interval: number;
  repetitions: number;
}

const list = ref<QuestionWithProgress[]>([]);
const searchQuery = ref('');
const statusFilter = ref<string>('all');
const expandedQuestionId = ref<string | null>(null);

const loadData = async () => {
  const allQuestions = await db.questions.toArray();
  const allProgress = await db.progress.toArray();
  
  const progressMap = new Map(allProgress.map(p => [p.questionId, p]));

  list.value = allQuestions.map(q => {
    const prog = progressMap.get(q.id);
    return {
      ...q,
      status: prog ? prog.status : 'new',
      ease: prog ? prog.ease : 2.5,
      interval: prog ? prog.interval : 0,
      repetitions: prog ? prog.repetitions : 0,
    };
  });
};

const handleToggleMaster = async (item: QuestionWithProgress) => {
  const nextVal = item.status !== 'mastered';
  await toggleMastered(item.id, nextVal);
  await loadData();
};

const handleResetProgress = async (item: QuestionWithProgress) => {
  if (confirm(`确定要重置“${item.target_word}”的记忆曲线进度吗？`)) {
    await db.progress.put(createDefaultProgress(item.id));
    await loadData();
  }
};

const filteredList = computed(() => {
  return list.value.filter(item => {
    // Search filter
    const query = searchQuery.value.toLowerCase().trim();
    const matchesSearch = 
      item.target_word.toLowerCase().includes(query) ||
      item.group_name.toLowerCase().includes(query) ||
      item.translation.toLowerCase().includes(query) ||
      item.question.toLowerCase().includes(query);

    // Status filter
    if (statusFilter.value === 'all') return matchesSearch;
    return matchesSearch && item.status === statusFilter.value;
  });
});

const toggleExpand = (id: string) => {
  expandedQuestionId.value = expandedQuestionId.value === id ? null : id;
};

onMounted(loadData);
</script>

<template>
  <div class="database-view slide-up">
    <div class="header">
      <h2>词库浏览器</h2>
      <p>搜索和浏览专四专八词汇辨析库，快速标记熟记单词或重置学习进度。</p>
    </div>

    <!-- Filters and Search Bar -->
    <div class="filters-bar glass-card">
      <div class="search-input-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="search-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input v-model="searchQuery" type="text" placeholder="输入单词、词组、中文释义或句子..." class="search-input" />
      </div>
      
      <div class="select-wrapper">
        <select v-model="statusFilter" class="status-select">
          <option value="all">所有状态</option>
          <option value="new">未学习</option>
          <option value="learning">学习中 (记忆曲线)</option>
          <option value="mastered">已熟记 (跳过)</option>
        </select>
      </div>
    </div>

    <!-- Main List -->
    <div class="list-container">
      <div v-if="filteredList.length === 0" class="no-results glass-card">
        <p>没有找到匹配的词条。请尝试其他搜索词或清除状态筛选。</p>
      </div>
      
      <div v-else class="list-grid">
        <div
          v-for="item in filteredList"
          :key="item.id"
          class="item-card glass-card"
          :class="{ expanded: expandedQuestionId === item.id }"
        >
          <div class="item-header" @click="toggleExpand(item.id)">
            <div class="word-info">
              <span class="badge" :class="item.level === 'TEM-8' ? 'badge-warning' : 'badge-primary'">{{ item.level }}</span>
              <span class="target-word">{{ item.target_word }}</span>
              <span class="group-name">（同组：{{ item.group_name }}）</span>
            </div>
            
            <div class="word-actions">
              <span class="status-badge" :class="item.status">{{ 
                item.status === 'mastered' ? '已熟记' : 
                item.status === 'learning' ? '复习中' : '未学习'
              }}</span>
              
              <button class="btn-expand">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" class="chevron">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Expanded content -->
          <div v-if="expandedQuestionId === item.id" class="item-body scale-in">
            <div class="info-row">
              <span class="label">挖空句</span>
              <p class="sentence">{{ item.question }}</p>
            </div>
            <div class="info-row">
              <span class="label">中文翻译</span>
              <p class="translation">{{ item.translation }}</p>
            </div>
            <div class="info-row">
              <span class="label">近义词解析</span>
              <div class="explanation-box">
                <div v-for="(detail, option) in item.distractor_analysis" :key="option" class="dict-item">
                  <strong class="dict-word">{{ option }}</strong>: <span>{{ detail }}</span>
                </div>
              </div>
            </div>
            <div class="info-row stats-row" v-if="item.status !== 'new'">
              <span class="label">记忆统计</span>
              <p>间隔: <strong>{{ item.interval }}天</strong> | 简易度: <strong>{{ item.ease.toFixed(2) }}</strong> | 重复数: <strong>{{ item.repetitions }}次</strong></p>
            </div>
            <div class="item-control-buttons">
              <button @click="handleToggleMaster(item)" class="btn-action master" :class="{ active: item.status === 'mastered' }">
                {{ item.status === 'mastered' ? '取消已熟记' : '标记为已熟记' }}
              </button>
              <button @click="handleResetProgress(item)" class="btn-action reset" v-if="item.status !== 'new'">
                重置进度
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.database-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.filters-bar {
  display: flex;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-input-wrapper {
  flex: 1;
  min-width: 280px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--border-color);
  padding: 0.65rem 1rem;
  border-radius: var(--radius-md);
}

[data-theme="dark"] .search-input-wrapper {
  background: rgba(15, 23, 42, 0.4);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  font-size: 0.95rem;
}

.select-wrapper {
  min-width: 180px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  padding: 0.65rem 1rem;
}

[data-theme="dark"] .select-wrapper {
  background: rgba(15, 23, 42, 0.4);
}

.status-select {
  width: 100%;
  font-size: 0.95rem;
  cursor: pointer;
}

.list-container {
  display: flex;
  flex-direction: column;
}

.list-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-results {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}

.item-card {
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.word-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.target-word {
  font-size: 1.15rem;
  font-weight: 700;
  font-family: var(--font-display);
}

.group-name {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.word-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  background-color: var(--border-color);
  color: var(--text-muted);
}

.status-badge.mastered { background-color: var(--primary-light); color: var(--primary); }
.status-badge.learning { background-color: var(--success-light); color: var(--success); }

.btn-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.chevron {
  width: 18px;
  height: 18px;
  transition: transform 0.3s ease;
}

.item-card.expanded .chevron {
  transform: rotate(180deg);
}

.item-body {
  border-top: 1px solid var(--border-color);
  padding-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  cursor: default;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-row .label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.info-row .sentence {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-main);
}

.info-row .translation {
  font-size: 0.95rem;
  color: var(--text-muted);
}

.explanation-box {
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dict-item {
  font-size: 0.9rem;
}

.dict-word {
  font-family: var(--font-mono);
  color: var(--primary);
}

.stats-row {
  font-size: 0.85rem;
}

.item-control-buttons {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-action {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.btn-action.master {
  background: var(--bg-app);
  border-color: var(--border-color);
  color: var(--text-muted);
}

.btn-action.master.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-action.master:not(.active):hover {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-action.reset {
  color: var(--error);
  border-color: var(--border-color);
}

.btn-action.reset:hover {
  background-color: var(--error-light);
  border-color: var(--error);
}
</style>
