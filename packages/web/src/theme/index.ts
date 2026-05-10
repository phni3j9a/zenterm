import { useEffect, useState } from 'react';
import { darkTokens, lightTokens, type ThemeTokens } from './tokens';

export type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'zenterm-theme-mode';

function detectSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme(): { tokens: ThemeTokens; mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    return (window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system';
  });
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(detectSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemTheme(mql.matches ? 'light' : 'dark');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, m);
    }
  };

  const effective = mode === 'system' ? systemTheme : mode;
  const tokens = effective === 'light' ? lightTokens : darkTokens;
  return { tokens, mode, setMode };
}

export type { ThemeTokens } from './tokens';
