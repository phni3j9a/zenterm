import { useEffect, useState } from 'react';
import { useSessionsStore } from '../../stores/sessions';
import { getSystemStatus } from '../../api/client';
import type { SystemStatus } from '@zenterm/shared';
import styles from './StatusBar.module.css';

export function StatusBar() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const sessions = useSessionsStore((s) => s.sessions);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  const activeSession = sessions.find((s) => s.name === activeSessionId);

  useEffect(() => {
    const controller = new AbortController();
    const fetchStatus = () => {
      getSystemStatus({ signal: controller.signal })
        .then(setStatus)
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return (
    <footer className={styles.statusBar}>
      <div className={styles.left}>
        {activeSession && (
          <>
            <span className={styles.dot} />
            <span className={styles.label}>{activeSession.displayName}</span>
            {activeSession.cwd && (
              <span className={styles.cwd}>{activeSession.cwd}</span>
            )}
          </>
        )}
      </div>
      <div className={styles.right}>
        {status && (
          <>
            <span className={styles.metric}>
              CPU {status.cpu.usage.toFixed(0)}%
            </span>
            <span className={styles.metric}>
              MEM {status.memory.percent.toFixed(0)}%
            </span>
            {status.temperature !== null && (
              <span className={styles.metric}>
                {status.temperature.toFixed(0)}°C
              </span>
            )}
          </>
        )}
      </div>
    </footer>
  );
}
