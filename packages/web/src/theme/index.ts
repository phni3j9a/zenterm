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
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--zen-focus-ring', tokens.colors.focusRing);
    // CSS-only interaction states (hover etc.) — inline styles can't express
    // pseudo-classes, so the active palette is mirrored into custom properties.
    rootStyle.setProperty('--zen-primary-hover', tokens.colors.primaryHover);
    rootStyle.setProperty('--zen-primary', tokens.colors.primary);
    rootStyle.setProperty('--zen-surface-hover', tokens.colors.surfaceHover);
    rootStyle.setProperty('--zen-overlay', tokens.colors.overlay);
    rootStyle.setProperty('--zen-scrollbar-thumb', tokens.colors.border);
    // Atmosphere knobs — the washi grain reads stronger on dark sumi than on
    // light paper, and selection / pop-shadow follow the active palette.
    rootStyle.setProperty('--zen-grain-opacity', resolvedTheme === 'dark' ? '0.05' : '0.035');
    rootStyle.setProperty(
      '--zen-selection',
      resolvedTheme === 'dark' ? 'rgba(166, 186, 152, 0.35)' : 'rgba(92, 113, 80, 0.25)',
    );
    rootStyle.setProperty(
      '--zen-shadow-pop',
      resolvedTheme === 'dark'
        ? '0 6px 20px rgba(0, 0, 0, 0.35)'
        : '0 6px 20px rgba(59, 53, 40, 0.18)',
    );
    document.documentElement.style.background = tokens.colors.bg;
    document.body.style.background = tokens.colors.bg;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [tokens, resolvedTheme]);

  return { tokens, mode, resolvedTheme, setMode: setThemeMode };
}

export type { ThemeTokens } from './tokens';
export type { ThemeMode } from '@/stores/settings';
