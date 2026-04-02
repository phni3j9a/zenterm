import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { SettingsPanel } from './SettingsPanel';
import styles from './Header.module.css';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSettings?: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar, onOpenSettings }: HeaderProps) {
  const logout = useAuthStore((s) => s.logout);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleSettings = () => {
    onOpenSettings?.();
    setSettingsOpen((value) => !value);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.iconBtn}
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {'\u2630'}
        </button>
        <div className={styles.logo}>
          <span className={styles.logoMark}>Z</span>
          <span className={styles.logoText}>ZenTerm</span>
        </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.settingsWrapper}>
          <button
            className={styles.iconBtn}
            onClick={toggleSettings}
            aria-label="Settings"
            title="Settings"
          >
            {'\u2699'}
          </button>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
        <button
          className={styles.iconBtn}
          onClick={logout}
          aria-label="Logout"
          title="Logout"
        >
          {'\u23fb'}
        </button>
      </div>
    </header>
  );
}
