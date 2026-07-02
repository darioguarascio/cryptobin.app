export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cryptobin.theme';

export function resolveTheme(stored: string | null): Theme {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'dark';
}

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent('cryptobin:theme-change', { detail: { theme } }));
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function getTheme(): Theme {
  return resolveTheme(getStoredTheme());
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
