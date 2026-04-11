import { create } from 'zustand';
import i18n from '../i18n';

type ThemeMode = 'light' | 'dark';

interface SettingsState {
  themeMode: ThemeMode;
  fontSize: number;
  fontFamily: string;
  language: string;
  notificationsEnabled: boolean;
  autoCopyOnSelect: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setLanguage: (lang: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setAutoCopyOnSelect: (enabled: boolean) => void;
}

const STORAGE_KEY = 'zenterm_settings';

const DEFAULT_FONT = "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', Menlo, monospace";

function loadSettings(): { themeMode: ThemeMode; fontSize: number; fontFamily: string; language: string; notificationsEnabled: boolean; autoCopyOnSelect: boolean } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        themeMode: parsed.themeMode ?? 'dark',
        fontSize: parsed.fontSize ?? 14,
        fontFamily: parsed.fontFamily ?? DEFAULT_FONT,
        language: parsed.language ?? 'en',
        notificationsEnabled: parsed.notificationsEnabled ?? false,
        autoCopyOnSelect: parsed.autoCopyOnSelect ?? false,
      };
    }
  } catch { /* ignore */ }
  return { themeMode: 'dark', fontSize: 14, fontFamily: DEFAULT_FONT, language: 'en', notificationsEnabled: false, autoCopyOnSelect: false };
}

function saveSettings(state: { themeMode: ThemeMode; fontSize: number; fontFamily: string; language: string; notificationsEnabled: boolean; autoCopyOnSelect: boolean }) {
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
        const next = { ...s, themeMode: mode };
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
    setFontFamily: (family) => {
      set((s) => {
        const next = { ...s, fontFamily: family };
        saveSettings(next);
        return next;
      });
    },
    setLanguage: (lang) => {
      i18n.changeLanguage(lang);
      set((s) => {
        const next = { ...s, language: lang };
        saveSettings(next);
        return next;
      });
    },
    setNotificationsEnabled: (enabled) => {
      set((s) => {
        const next = { ...s, notificationsEnabled: enabled };
        saveSettings(next);
        return next;
      });
    },
    setAutoCopyOnSelect: (enabled) => {
      set((s) => {
        const next = { ...s, autoCopyOnSelect: enabled };
        saveSettings(next);
        return next;
      });
    },
  };
});
