import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ja' | 'es' | 'fr' | 'de' | 'pt-BR' | 'zh-CN' | 'ko';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'ja', 'es', 'fr', 'de', 'pt-BR', 'zh-CN', 'ko'];

export const LANGUAGE_LABELS: Record<Language, string> = {
  ja: '日本語',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  'pt-BR': 'Português (BR)',
  'zh-CN': '简体中文',
  ko: '한국어',
};

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
  dismissOnboarding: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (size: number) => void;
  setAutoCopyOnSelect: (value: boolean) => void;
  setDismissOnboarding: (value: boolean) => void;
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

interface PersistedV3 extends PersistedV2 {
  dismissOnboarding: boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
      autoCopyOnSelect: false,
      dismissOnboarding: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setFontSize: (size) => set({ fontSize: clampFontSize(size) }),
      setAutoCopyOnSelect: (autoCopyOnSelect) => set({ autoCopyOnSelect }),
      setDismissOnboarding: (dismissOnboarding) => set({ dismissOnboarding }),
    }),
    {
      name: 'zenterm-web-settings',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        language: state.language,
        fontSize: state.fontSize,
        autoCopyOnSelect: state.autoCopyOnSelect,
        dismissOnboarding: state.dismissOnboarding,
      }),
      migrate: (persistedState, version): PersistedV3 => {
        const s = (persistedState ?? {}) as Partial<PersistedV3>;
        if (version < 2) {
          return {
            themeMode: s.themeMode ?? 'system',
            language: normalizeLanguage(s.language),
            fontSize: typeof s.fontSize === 'number' ? s.fontSize : DEFAULT_FONT_SIZE,
            autoCopyOnSelect: false,
            dismissOnboarding: false,
          };
        }
        if (version < 3) {
          return {
            themeMode: s.themeMode ?? 'system',
            language: normalizeLanguage(s.language),
            fontSize: typeof s.fontSize === 'number' ? s.fontSize : DEFAULT_FONT_SIZE,
            autoCopyOnSelect: s.autoCopyOnSelect ?? false,
            dismissOnboarding: false,
          };
        }
        return {
          themeMode: s.themeMode ?? 'system',
          language: normalizeLanguage(s.language),
          fontSize: typeof s.fontSize === 'number' ? s.fontSize : DEFAULT_FONT_SIZE,
          autoCopyOnSelect: s.autoCopyOnSelect ?? false,
          dismissOnboarding: s.dismissOnboarding ?? false,
        };
      },
      // onRehydrateStorage fires after migrate for the same-version path (where migrate
      // is not called by zustand). Use setState() to properly notify subscribers instead
      // of mutating state in-place.
      onRehydrateStorage: () => (state) => {
        if (state && !SUPPORTED_LANGUAGES.includes(state.language)) {
          useSettingsStore.setState({ language: 'ja' });
        }
      },
    },
  ),
);
