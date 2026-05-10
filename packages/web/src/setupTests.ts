import '@testing-library/jest-dom/vitest';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './i18n/locales/en.json';
import ja from './i18n/locales/ja.json';

// Initialize i18next for tests with English forced.
// We bypass initI18n() to avoid the settings-store subscription that would
// switch the language whenever a test sets useSettingsStore({ language: 'ja' }).
void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});
