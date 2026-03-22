import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import React, { createContext, useContext, useMemo } from 'react';
import { type ColorSchemeName } from 'react-native';

import { useSettingsStore } from '../stores/settings';
import { colors, colorsDark, radii, shadows, spacing, typography, type ColorTokens, type ThemeMode } from './tokens';

export interface AppTheme {
  dark: boolean;
  colors: ColorTokens;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  navigationTheme: NavigationTheme;
}

const ThemeContext = createContext<AppTheme | null>(null);

export const resolveTheme = (themeMode: ThemeMode, _systemScheme?: ColorSchemeName): AppTheme => {
  const dark = themeMode === 'dark';
  const colorTokens = dark ? colorsDark : colors;
  const baseNavTheme = dark ? DarkTheme : DefaultTheme;

  const navigationTheme: NavigationTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      primary: colorTokens.primary,
      background: colorTokens.bg,
      card: dark ? colorTokens.surface : colorTokens.bg,
      text: colorTokens.textPrimary,
      border: colorTokens.border,
      notification: colorTokens.primary,
    },
  };

  return {
    dark,
    colors: colorTokens,
    typography,
    spacing,
    radii,
    shadows,
    navigationTheme,
  };
};

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useSettingsStore((state) => state.settings.themeMode);
  const theme = useMemo(() => resolveTheme(themeMode), [themeMode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within AppThemeProvider');
  }
  return theme;
}
