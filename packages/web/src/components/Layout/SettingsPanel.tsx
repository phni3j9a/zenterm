import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settings';
import styles from './SettingsPanel.module.css';

const FONT_SIZES = [12, 13, 14, 15, 16, 18] as const;

const FONT_FAMILIES = [
  { label: 'Default (Fira Code)', value: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', Menlo, monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Cascadia Code', value: "'Cascadia Code', monospace" },
  { label: 'SF Mono', value: "'SF Mono', Menlo, monospace" },
  { label: 'Menlo', value: "Menlo, Monaco, monospace" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'System Mono', value: "monospace" },
];

const LANGUAGES = [
  { code: 'en', labelKey: 'settings.languageEn' },
  { code: 'ja', labelKey: 'settings.languageJa' },
  { code: 'de', labelKey: 'settings.languageDe' },
  { code: 'es', labelKey: 'settings.languageEs' },
  { code: 'fr', labelKey: 'settings.languageFr' },
  { code: 'pt-BR', labelKey: 'settings.languagePtBr' },
  { code: 'zh-CN', labelKey: 'settings.languageZhCn' },
  { code: 'ko', labelKey: 'settings.languageKo' },
];

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t } = useTranslation();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const autoCopyOnSelect = useSettingsStore((s) => s.autoCopyOnSelect);
  const setAutoCopyOnSelect = useSettingsStore((s) => s.setAutoCopyOnSelect);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.item}>
        <span className={styles.label}>{t('settings.theme')}</span>
        <button className={styles.value} onClick={toggleTheme}>
          {themeMode === 'dark' ? t('common.dark') : t('common.light')}
        </button>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>{t('settings.fontSize')}</span>
        <select
          className={styles.select}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>{t('settings.fontFamily')}</span>
        <select
          className={styles.select}
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>{t('settings.language')}</span>
        <select
          className={styles.select}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {t(l.labelKey)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>{t('settings.autoCopy')}</span>
        <button className={styles.value} onClick={() => setAutoCopyOnSelect(!autoCopyOnSelect)}>
          {autoCopyOnSelect ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
