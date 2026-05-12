import { useEffect, useState } from 'react';
import { useSettingsStore, type ThemeMode } from '@/stores/settings';
import { darkTokens, lightTokens, type ThemeTokens } from './tokens';

function detectSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme(): {
  tokens: ThemeTokens;
  mode: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  setMode: (m: ThemeMode) => void;
} {
  const mode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(detectSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemTheme(mql.matches ? 'light' : 'dark');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = mode === 'system' ? systemTheme : mode;
  const tokens = resolvedTheme === 'light' ? lightTokens : darkTokens;

  useEffect(() => {
    document.documentElement.style.setProperty('--zen-focus-ring', tokens.colors.focusRing);
  }, [tokens]);

  return { tokens, mode, resolvedTheme, setMode: setThemeMode };
}

export type { ThemeTokens } from './tokens';
export type { ThemeMode } from '@/stores/settings';
