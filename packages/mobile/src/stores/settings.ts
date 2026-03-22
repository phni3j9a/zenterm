import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { ThemeMode } from '../theme/tokens';

const SETTINGS_KEY = 'zenterm_settings';

interface Settings {
  fontSize: number;
  themeMode: ThemeMode;
}

const defaultSettings: Settings = {
  fontSize: 10,
  themeMode: 'light',
};

interface SettingsState {
  loaded: boolean;
  settings: Settings;
  load: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  reset: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  loaded: false,
  settings: { ...defaultSettings },
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        const merged = { ...defaultSettings, ...parsed };
        if ((merged.themeMode as string) === 'system') {
          merged.themeMode = 'light';
        }
        set({
          settings: merged,
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },
  updateSettings: async (updates) => {
    const prev = get().settings;
    const next = { ...prev, ...updates };
    set({ settings: next });
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      set({ settings: prev });
      console.warn('Failed to persist settings:', error);
    }
  },
  reset: async () => {
    const prev = get().settings;
    set({ settings: { ...defaultSettings } });
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
      set({ settings: prev });
      console.warn('Failed to reset settings:', error);
    }
  },
}));
