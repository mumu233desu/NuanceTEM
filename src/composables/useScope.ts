import { ref, watch } from 'vue';

export type LevelScope = 'ALL' | 'TEM-4' | 'TEM-8';

const SCOPE_STORAGE_KEY = 'nuancetem_active_scope';

const savedScope = (localStorage.getItem(SCOPE_STORAGE_KEY) as LevelScope) || 'ALL';
const currentScope = ref<LevelScope>(
  ['ALL', 'TEM-4', 'TEM-8'].includes(savedScope) ? savedScope : 'ALL'
);

watch(currentScope, (newScope) => {
  localStorage.setItem(SCOPE_STORAGE_KEY, newScope);
});

export function useScope() {
  const setScope = (scope: LevelScope) => {
    currentScope.value = scope;
  };

  return {
    currentScope,
    setScope,
  };
}
