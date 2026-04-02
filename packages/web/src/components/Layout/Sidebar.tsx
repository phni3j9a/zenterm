import { useEffect, useState } from 'react';
import { useSessionsStore } from '../../stores/sessions';
import { FileBrowser } from '../FileManager/FileBrowser';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import styles from './Sidebar.module.css';

type SidebarView = 'sessions' | 'files';

export function Sidebar() {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const openTab = useSessionsStore((s) => s.openTab);
  const createSession = useSessionsStore((s) => s.createSession);
  const deleteSession = useSessionsStore((s) => s.deleteSession);
  const renameSession = useSessionsStore((s) => s.renameSession);
  const fetchSessions = useSessionsStore((s) => s.fetchSessions);
  const loading = useSessionsStore((s) => s.loading);
  const error = useSessionsStore((s) => s.error);

  const [view, setView] = useState<SidebarView>('sessions');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchSessions();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchSessions]);

  const handleRenameStart = (id: string, displayName: string) => {
    setRenamingId(id);
    setRenameValue(displayName);
  };

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim() && renameValue.trim() !== id) {
      await renameSession(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDeleteRequest = (id: string) => {
    setDeletingId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    await deleteSession(deletingId);
    setDeletingId(null);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.viewToggle}>
        <button
          className={styles.viewBtn}
          data-active={view === 'sessions'}
          onClick={() => setView('sessions')}
        >
          Sessions
        </button>
        <button
          className={styles.viewBtn}
          data-active={view === 'files'}
          onClick={() => setView('files')}
        >
          Files
        </button>
      </div>

      {view === 'sessions' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Sessions</span>
            <button
              className={styles.addBtn}
              onClick={() => createSession()}
              aria-label="New session"
            >
              +
            </button>
          </div>
          <div className={styles.list}>
            {loading && sessions.length === 0 && (
              <div className={styles.empty}>Loading...</div>
            )}
            {!loading && sessions.length === 0 && (
              <div className={styles.empty}>No sessions</div>
            )}
            {error && (
              <div className={styles.error}>{error}</div>
            )}
            {sessions.map((session) => (
              <div
                key={session.name}
                className={styles.item}
                data-active={session.name === activeSessionId}
                onClick={() => openTab(session.name)}
              >
                {renamingId === session.name ? (
                  <input
                    className={styles.renameInput}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(session.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(session.name);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className={styles.itemIcon}>&#9654;</span>
                    <span
                      className={styles.itemLabel}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleRenameStart(session.name, session.displayName);
                      }}
                    >
                      {session.displayName}
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRequest(session.name);
                      }}
                      aria-label="Delete session"
                    >
                      &times;
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'files' && <FileBrowser />}
      {deletingId && (
        <ConfirmDialog
          title="Delete Session"
          message={`Are you sure you want to delete "${deletingId.replace(/^zen_/, '')}"?`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </aside>
  );
}
