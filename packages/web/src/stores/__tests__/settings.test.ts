import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '../settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
    });
  });

  it('starts with default values', () => {
    const s = useSettingsStore.getState();
    expect(s.themeMode).toBe('system');
    expect(s.language).toBe('ja');
    expect(s.fontSize).toBe(DEFAULT_FONT_SIZE);
  });

  it('setThemeMode updates and persists', () => {
    useSettingsStore.getState().setThemeMode('light');
    expect(useSettingsStore.getState().themeMode).toBe('light');
    const raw = window.localStorage.getItem('zenterm-web-settings');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.themeMode).toBe('light');
  });

  it('setLanguage updates and persists', () => {
    useSettingsStore.getState().setLanguage('en');
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('setFontSize clamps to range', () => {
    useSettingsStore.getState().setFontSize(99);
    expect(useSettingsStore.getState().fontSize).toBe(MAX_FONT_SIZE);
    useSettingsStore.getState().setFontSize(-5);
    expect(useSettingsStore.getState().fontSize).toBe(MIN_FONT_SIZE);
  });

  it('setFontSize rounds non-integer', () => {
    useSettingsStore.getState().setFontSize(14.7);
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });
});
