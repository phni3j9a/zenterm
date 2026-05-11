import '@testing-library/jest-dom/vitest';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './i18n/locales/en.json';
import ja from './i18n/locales/ja.json';

// jsdom's Blob does not implement .stream(), but undici's Response constructor
// (used by `new Response(blob)`) requires it. Polyfill so tests that build a
// Response from a Blob work.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.stream !== 'function') {
  Object.defineProperty(Blob.prototype, 'stream', {
    configurable: true,
    writable: true,
    value: function stream(this: Blob) {
      const blob = this;
      return new ReadableStream({
        async start(controller) {
          const buf = await blob.arrayBuffer();
          controller.enqueue(new Uint8Array(buf));
          controller.close();
        },
      });
    },
  });
}

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
