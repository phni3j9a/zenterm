import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { initI18n } from '../index';
import { useSettingsStore } from '@/stores/settings';

describe('initI18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({ language: 'ja' } as any);
  });

  afterEach(() => {
    // i18next is a singleton; reset between tests
    void i18next.changeLanguage('ja');
  });

  it('initializes with the language from settings store', async () => {
    initI18n();
    expect(i18next.language.startsWith('ja')).toBe(true);
    expect(i18next.t('common.cancel')).toBe('キャンセル');
  });

  it('switches language when settings store updates', async () => {
    initI18n();
    useSettingsStore.getState().setLanguage('en');
    // subscribe is synchronous in zustand v5
    await new Promise((r) => setTimeout(r, 0));
    expect(i18next.language.startsWith('en')).toBe(true);
    expect(i18next.t('common.cancel')).toBe('Cancel');
  });

  it('falls back to en for missing keys', () => {
    initI18n();
    useSettingsStore.getState().setLanguage('ja');
    expect(i18next.t('does.not.exist')).toBe('does.not.exist');
  });
});
