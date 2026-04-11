import { useRef, useEffect, useState, useCallback } from 'react';
import { useTerminal, type ConnectionStatus } from '../../hooks/useTerminal';
import { useTerminalNotifications } from '../../hooks/useTerminalNotifications';
import { SearchBar } from './SearchBar';
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
  const [searchVisible, setSearchVisible] = useState(false);

  const onStatusChange = useCallback((s: ConnectionStatus, message?: string) => {
    setStatus(s);
    setStatusMessage(message ?? '');
  }, []);
  const onOutputRef = useTerminalNotifications(sessionId);
  const onOutput = useCallback((data: string) => {
    onOutputRef.current?.(data);
  }, [onOutputRef]);
  const { attach, focus, searchRef, wsRef } = useTerminal({ sessionId, onStatusChange, onOutput });

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

  // Ctrl+Shift+F to toggle search (only when active)
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setSearchVisible((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const filePath = e.dataTransfer.getData('application/x-zenterm-path');
    if (!filePath) return;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      // Shell-escape the path: wrap in single quotes, escape existing quotes
      const escaped = "'" + filePath.replace(/'/g, "'\\''") + "' ";
      ws.send(JSON.stringify({ type: 'input', data: escaped }));
    }
  }, [wsRef]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-zenterm-path')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  return (
    <div
      className={styles.wrapper}
      data-active={active}
      data-status={status}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >      <SearchBar searchRef={searchRef} visible={searchVisible} onClose={() => setSearchVisible(false)} />
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
