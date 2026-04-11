import { useTranslation } from 'react-i18next';
import { Layout } from '../components/Layout/Layout';
import { TerminalTabs } from '../components/Terminal/TerminalTabs';
import { TerminalView } from '../components/Terminal/Terminal';
import { PaneLayout } from '../components/Terminal/PaneLayout';
import { useSessionsStore } from '../stores/sessions';
import { usePanesStore } from '../stores/panes';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import styles from './MainPage.module.css';

export function MainPage() {
  const { t } = useTranslation();
  const openTabs = useSessionsStore((s) => s.openTabs);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const createSession = useSessionsStore((s) => s.createSession);
  const root = usePanesStore((s) => s.root);

  useKeyboardShortcuts();

  const hasTabs = openTabs.length > 0;
  const hasPanes = root !== null && root.type === 'split';

  return (
    <Layout>
      {hasTabs ? (
        <>
          <TerminalTabs />
          <div className={styles.terminalArea}>
            {hasPanes ? (
              <PaneLayout node={root} />
            ) : (
              openTabs.map((id) => (
                <TerminalView
                  key={id}
                  sessionId={id}
                  active={id === activeSessionId}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyContent}>
            <span className={styles.emptyIcon}>&#9654;</span>
            <p className={styles.emptyText}>
              {t('sessions.selectSession')}
            </p>
            <button className={styles.emptyBtn} onClick={() => createSession()}>
              {t('sessions.newSession')}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
