import { useSessionsStore } from '../../stores/sessions';
import styles from './TerminalTabs.module.css';

export function TerminalTabs() {
  const openTabs = useSessionsStore((s) => s.openTabs);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSession = useSessionsStore((s) => s.setActiveSession);
  const closeTab = useSessionsStore((s) => s.closeTab);
  const createSession = useSessionsStore((s) => s.createSession);

  const getDisplayName = (id: string) => {
    const session = sessions.find((s) => s.name === id);
    return session?.displayName ?? id.replace(/^zen_/, '');
  };

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabs}>
        {openTabs.map((id) => (
          <button
            key={id}
            className={styles.tab}
            data-active={id === activeSessionId}
            onClick={() => setActiveSession(id)}
          >
            <span className={styles.tabLabel}>{getDisplayName(id)}</span>
            <button
              className={styles.tabClose}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(id);
              }}
              aria-label="Close tab"
            >
              &times;
            </button>
          </button>
        ))}
      </div>
      <button
        className={styles.newTab}
        onClick={() => createSession()}
        aria-label="New session"
      >
        +
      </button>
    </div>
  );
}
