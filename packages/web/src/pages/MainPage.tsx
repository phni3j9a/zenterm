import { Layout } from '../components/Layout/Layout';
import { TerminalTabs } from '../components/Terminal/TerminalTabs';
import { TerminalView } from '../components/Terminal/Terminal';
import { useSessionsStore } from '../stores/sessions';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import styles from './MainPage.module.css';

export function MainPage() {
  const openTabs = useSessionsStore((s) => s.openTabs);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const createSession = useSessionsStore((s) => s.createSession);

  useKeyboardShortcuts();

  return (
    <Layout>
      {openTabs.length > 0 ? (
        <>
          <TerminalTabs />
          <div className={styles.terminalArea}>
            {openTabs.map((id) => (
              <TerminalView
                key={id}
                sessionId={id}
                active={id === activeSessionId}
              />
            ))}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyContent}>
            <span className={styles.emptyIcon}>&#9654;</span>
            <p className={styles.emptyText}>
              Select a session from the sidebar or create a new one
            </p>
            <button className={styles.emptyBtn} onClick={() => createSession()}>
              New Session
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
