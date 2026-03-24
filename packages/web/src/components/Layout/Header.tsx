import { useSettingsStore } from '../../stores/settings';
import { useAuthStore } from '../../stores/auth';
import styles from './Header.module.css';

export function Header() {
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoMark}>Z</span>
        <span className={styles.logoText}>ZenTerm</span>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.iconBtn}
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {themeMode === 'dark' ? '○' : '●'}
        </button>
        <button
          className={styles.iconBtn}
          onClick={logout}
          aria-label="Logout"
          title="Logout"
        >
          ⏻
        </button>
      </div>
    </header>
  );
}
