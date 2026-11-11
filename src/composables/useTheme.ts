import { ref, computed, watchEffect } from 'vue';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

// Module-level singleton state so all components share the exact same reactive refs
const themePreference = ref<ThemePreference>(
  (localStorage.getItem(STORAGE_KEY) as ThemePreference) || 'system'
);

const systemPrefersDark = ref(
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
);

// Computed effective dark mode boolean
const isDarkMode = computed(() => {
  if (themePreference.value === 'dark') return true;
  if (themePreference.value === 'light') return false;
  return systemPrefersDark.value;
});

let isInitialized = false;

export function useTheme() {
  const applyThemeToDOM = (isDark: boolean) => {
    if (typeof document === 'undefined') return;
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    const meta = document.getElementById('meta-theme-color');
    if (meta) {
      meta.setAttribute('content', isDark ? '#090e1a' : '#fcfaf7');
    }
  };

  const setTheme = (pref: ThemePreference) => {
    themePreference.value = pref;
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
    // Dispatch custom event for any external consumers
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: pref }));
  };

  const toggleTheme = () => {
    // If currently dark (either via preference or system), switch to light; otherwise switch to dark
    const nextTheme: ThemePreference = isDarkMode.value ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const initTheme = () => {
    if (isInitialized || typeof window === 'undefined') return;
    isInitialized = true;

    // Reactively update DOM whenever isDarkMode changes
    watchEffect(() => {
      applyThemeToDOM(isDarkMode.value);
    });

    // Listen to system color scheme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      systemPrefersDark.value = e.matches;
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    // Listen to storage events across browser tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        themePreference.value = (e.newValue as ThemePreference) || 'system';
      }
    });

    // Initial sync
    applyThemeToDOM(isDarkMode.value);
  };

  return {
    themePreference,
    isDarkMode,
    setTheme,
    toggleTheme,
    initTheme,
  };
}
