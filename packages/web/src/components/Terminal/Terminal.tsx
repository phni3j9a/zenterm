import { useRef, useEffect, useState, useCallback } from 'react';
import { useTerminal, type ConnectionStatus } from '../../hooks/useTerminal';
import styles from './Terminal.module.css';

interface TerminalProps {
  sessionId: string;
  active: boolean;
}

export function TerminalView({ sessionId, active }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const onStatusChange = useCallback((s: ConnectionStatus, message?: string) => {
    setStatus(s);
    setStatusMessage(message ?? '');
  }, []);
  const { attach, focus } = useTerminal({ sessionId, onStatusChange });

  useEffect(() => {
    if (!containerRef.current) return;
    cleanupRef.current = attach(containerRef.current);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [attach]);

  useEffect(() => {
    if (active) focus();
  }, [active, focus]);

  return (
    <div className={styles.wrapper} data-active={active} data-status={status}>
      <div ref={containerRef} className={styles.container} />
      {status !== 'connected' && (
        <div className={styles.statusOverlay}>
          <span className={styles.statusDot} data-status={status} />
          <span className={styles.statusText}>
            {statusMessage || (
              <>
                {status === 'connecting' && 'Connecting...'}
                {status === 'disconnected' && 'Disconnected'}
                {status === 'error' && 'Connection error'}
                {status === 'reconnecting' && 'Reconnecting...'}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
