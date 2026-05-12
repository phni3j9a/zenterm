import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ptBR from './locales/pt-BR.json';
import zhCN from './locales/zh-CN.json';
import ko from './locales/ko.json';
import { useSettingsStore } from '@/stores/settings';

let initialized = false;

export function initI18n(): void {
  const initialLang = useSettingsStore.getState().language;

  if (!initialized) {
    void i18next.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        ja: { translation: ja },
        es: { translation: es },
        fr: { translation: fr },
        de: { translation: de },
        'pt-BR': { translation: ptBR },
        'zh-CN': { translation: zhCN },
        ko: { translation: ko },
      },
      lng: initialLang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    useSettingsStore.subscribe((state) => {
      if (i18next.language !== state.language) {
        void i18next.changeLanguage(state.language);
      }
    });
    initialized = true;
  } else {
    void i18next.changeLanguage(initialLang);
  }
}
