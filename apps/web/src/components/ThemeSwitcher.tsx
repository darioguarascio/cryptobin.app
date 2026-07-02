import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';

export default function ThemeSwitcher() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    setThemeState(getTheme());

    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ theme: Theme }>).detail;
      if (detail?.theme) {
        setThemeState(detail.theme);
      }
    };

    window.addEventListener('cryptobin:theme-change', onThemeChange);
    return () => window.removeEventListener('cryptobin:theme-change', onThemeChange);
  }, []);

  return (
    <button
      type="button"
      className="theme-switcher"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={() => setThemeState(toggleTheme())}
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
