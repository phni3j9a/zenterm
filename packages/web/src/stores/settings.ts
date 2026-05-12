import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ja' | 'es' | 'fr' | 'de' | 'pt-BR' | 'zh-CN' | 'ko';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'ja', 'es', 'fr', 'de', 'pt-BR', 'zh-CN', 'ko'];

function normalizeLanguage(value: unknown): Language {
  if (typeof value !== 'string') return 'ja';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    ? (value as Language)
    : 'ja';
}

export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 20;
export const DEFAULT_FONT_SIZE = 14;

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  fontSize: number;
  autoCopyOnSelect: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (size: number) => void;
  setAutoCopyOnSelect: (value: boolean) => void;
}

function clampFontSize(size: number): number {
  const rounded = Math.round(size);
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, rounded));
}

interface PersistedV1 {
  themeMode: ThemeMode;
  language: Language;
  fontSize: number;
}

interface PersistedV2 extends PersistedV1 {
  autoCopyOnSelect: boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
      autoCopyOnSelect: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setFontSize: (size) => set({ fontSize: clampFontSize(size) }),
      setAutoCopyOnSelect: (autoCopyOnSelect) => set({ autoCopyOnSelect }),
    }),
    {
      name: 'zenterm-web-settings',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        language: state.language,
        fontSize: state.fontSize,
        autoCopyOnSelect: state.autoCopyOnSelect,
      }),
      migrate: (persistedState, version): PersistedV2 => {
        const s = (persistedState ?? {}) as Partial<PersistedV2>;
        if (version < 2) {
          return {
            themeMode: s.themeMode ?? 'system',
            language: normalizeLanguage(s.language),
            fontSize: typeof s.fontSize === 'number' ? s.fontSize : DEFAULT_FONT_SIZE,
            autoCopyOnSelect: false,
          };
        }
        return {
          themeMode: s.themeMode ?? 'system',
          language: normalizeLanguage(s.language),
          fontSize: typeof s.fontSize === 'number' ? s.fontSize : DEFAULT_FONT_SIZE,
          autoCopyOnSelect: s.autoCopyOnSelect ?? false,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state && !SUPPORTED_LANGUAGES.includes(state.language)) {
          state.language = 'ja';
        }
      },
    },
  ),
);
