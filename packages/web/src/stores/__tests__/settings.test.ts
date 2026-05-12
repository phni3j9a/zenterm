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

describe('settings — 8 languages support', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('accepts es language', () => {
    useSettingsStore.getState().setLanguage('es');
    expect(useSettingsStore.getState().language).toBe('es');
  });

  it('accepts ko language', () => {
    useSettingsStore.getState().setLanguage('ko');
    expect(useSettingsStore.getState().language).toBe('ko');
  });

  it('rehydrates with ja fallback when persisted language is invalid (current version)', () => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'xx-XX', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
    useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().language).toBe('ja');
  });

  it('migrate (v1 → v2) falls back to ja for unknown language string', () => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'qq-QQ', fontSize: 16 },
        version: 1,
      }),
    );
    useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().language).toBe('ja');
  });
});

describe('useSettingsStore autoCopyOnSelect', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
      autoCopyOnSelect: false,
    } as any);
  });

  it('defaults to false', () => {
    expect(useSettingsStore.getState().autoCopyOnSelect).toBe(false);
  });

  it('setAutoCopyOnSelect updates and persists', () => {
    useSettingsStore.getState().setAutoCopyOnSelect(true);
    expect(useSettingsStore.getState().autoCopyOnSelect).toBe(true);
    const raw = window.localStorage.getItem('zenterm-web-settings');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.autoCopyOnSelect).toBe(true);
    expect(JSON.parse(raw!).version).toBe(2);
  });

  it('migrates v1 persisted state by adding autoCopyOnSelect: false', async () => {
    window.localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 16 },
        version: 1,
      }),
    );
    // Force re-hydration by re-importing via dynamic import is complex; instead,
    // call the persist `rehydrate` API directly.
    await (useSettingsStore as any).persist.rehydrate();
    const s = useSettingsStore.getState();
    expect(s.themeMode).toBe('dark');
    expect(s.language).toBe('en');
    expect(s.fontSize).toBe(16);
    expect(s.autoCopyOnSelect).toBe(false);
  });
});
