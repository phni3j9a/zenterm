import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

interface SettingsState {
  themeMode: ThemeMode;
  fontSize: number;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setFontSize: (size: number) => void;
}

const STORAGE_KEY = 'zenterm_settings';

function loadSettings(): { themeMode: ThemeMode; fontSize: number } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        themeMode: parsed.themeMode ?? 'dark',
        fontSize: parsed.fontSize ?? 14,
      };
    }
  } catch { /* ignore */ }
  return { themeMode: 'dark', fontSize: 14 };
}

function saveSettings(state: { themeMode: ThemeMode; fontSize: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initial = loadSettings();
  document.documentElement.setAttribute('data-theme', initial.themeMode);

  return {
    ...initial,
    setThemeMode: (mode) => {
      document.documentElement.setAttribute('data-theme', mode);
      set((s) => {
        const next = { ...s, themeMode: mode };
        saveSettings(next);
        return next;
      });
    },
    toggleTheme: () => {
      set((s) => {
        const mode: ThemeMode = s.themeMode === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', mode);
        const next = { themeMode: mode, fontSize: s.fontSize };
        saveSettings(next);
        return next;
      });
    },
    setFontSize: (size) => {
      set((s) => {
        const next = { ...s, fontSize: size };
        saveSettings(next);
        return next;
      });
    },
  };
});
