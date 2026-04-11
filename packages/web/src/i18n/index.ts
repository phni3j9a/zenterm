import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import ja from './locales/ja';
import de from './locales/de';
import es from './locales/es';
import fr from './locales/fr';
import ptBR from './locales/pt-BR';
import zhCN from './locales/zh-CN';
import ko from './locales/ko';

const savedLanguage = (() => {
  try {
    const raw = localStorage.getItem('zenterm-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.language) return parsed.state.language;
    }
  } catch { /* ignore */ }
  return navigator.language.startsWith('ja') ? 'ja' :
         navigator.language.startsWith('de') ? 'de' :
         navigator.language.startsWith('es') ? 'es' :
         navigator.language.startsWith('fr') ? 'fr' :
         navigator.language.startsWith('pt') ? 'pt-BR' :
         navigator.language.startsWith('zh') ? 'zh-CN' :
         navigator.language.startsWith('ko') ? 'ko' :
         'en';
})();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    'pt-BR': { translation: ptBR },
    'zh-CN': { translation: zhCN },
    ko: { translation: ko },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
