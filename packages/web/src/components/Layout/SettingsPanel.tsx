import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../stores/settings';
import styles from './SettingsPanel.module.css';

const FONT_SIZES = [12, 13, 14, 15, 16, 18] as const;

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const themeMode = useSettingsStore((state) => state.themeMode);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
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
        <span className={styles.label}>Theme</span>
        <button className={styles.value} onClick={toggleTheme}>
          {themeMode === 'dark' ? 'Dark' : 'Light'}
        </button>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>Font Size</span>
        <select
          className={styles.select}
          value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value))}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
