import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const readTheme = (): Theme => {
  try {
    const saved = localStorage.getItem('meettask-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Storage may be unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const sync = () => setTheme(readTheme());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener('meettask-theme', sync);
    window.addEventListener('storage', sync);
    media.addEventListener('change', sync);
    return () => {
      window.removeEventListener('meettask-theme', sync);
      window.removeEventListener('storage', sync);
      media.removeEventListener('change', sync);
    };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('meettask-theme', next); } catch { /* Keep in-memory choice. */ }
    setTheme(next);
    window.dispatchEvent(new Event('meettask-theme'));
  };
  return { theme, toggleTheme };
}
