import { useSessionsStore } from '../../stores/sessions';
import { usePanesStore } from '../../stores/panes';
import styles from './TerminalTabs.module.css';

export function TerminalTabs() {
  const openTabs = useSessionsStore((s) => s.openTabs);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSession = useSessionsStore((s) => s.setActiveSession);
  const closeTab = useSessionsStore((s) => s.closeTab);
  const createSession = useSessionsStore((s) => s.createSession);
  const root = usePanesStore((s) => s.root);
  const splitPane = usePanesStore((s) => s.splitPane);

  const getDisplayName = (id: string) => {
    const session = sessions.find((s) => s.name === id);
    return session?.displayName ?? id.replace(/^zen_/, '');
  };

  const handleSplit = async (direction: 'horizontal' | 'vertical') => {
    const session = await createSession();
    if (root) {
      splitPane(direction, session.name);
    }
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
      <div className={styles.tabActions}>
        {root && (
          <>
            <button
              className={styles.splitBtn}
              onClick={() => handleSplit('horizontal')}
              aria-label="Split right"
              title="Split Right"
            >
              &#9646;&#9646;
            </button>
            <button
              className={styles.splitBtn}
              onClick={() => handleSplit('vertical')}
              aria-label="Split down"
              title="Split Down"
            >
              &#9866;
            </button>
          </>
        )}
        <button
          className={styles.newTab}
          onClick={() => createSession()}
          aria-label="New session"
        >
          +
        </button>
      </div>
    </div>
  );
}
