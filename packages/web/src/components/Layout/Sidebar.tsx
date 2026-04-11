import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionsStore } from '../../stores/sessions';
import { FileBrowser } from '../FileManager/FileBrowser';
import { SystemMonitor } from '../Monitor/SystemMonitor';
import { ScrollbackPanel } from './ScrollbackPanel';
import { SshQuickConnect } from './SshQuickConnect';
import { ServerManager } from './ServerManager';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import styles from './Sidebar.module.css';

type SidebarView = 'sessions' | 'files' | 'monitor' | 'scrollback' | 'ssh' | 'servers';

export function Sidebar() {
  const { t } = useTranslation();
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const openTab = useSessionsStore((s) => s.openTab);
  const createSession = useSessionsStore((s) => s.createSession);
  const deleteSession = useSessionsStore((s) => s.deleteSession);
  const renameSession = useSessionsStore((s) => s.renameSession);
  const fetchSessions = useSessionsStore((s) => s.fetchSessions);
  const loading = useSessionsStore((s) => s.loading);
  const error = useSessionsStore((s) => s.error);
  const bookmarked = useSessionsStore((s) => s.bookmarked);
  const toggleBookmark = useSessionsStore((s) => s.toggleBookmark);

  // Sort bookmarked sessions to top
  const sortedSessions = [...sessions].sort((a, b) => {
    const aBookmarked = bookmarked.has(a.name) ? 0 : 1;
    const bBookmarked = bookmarked.has(b.name) ? 0 : 1;
    return aBookmarked - bBookmarked;
  });

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
          {t('tabs.sessions')}
        </button>
        <button
          className={styles.viewBtn}
          data-active={view === 'files'}
          onClick={() => setView('files')}
        >
          {t('tabs.files')}
        </button>
        <button
          className={styles.viewBtn}
          data-active={view === 'monitor'}
          onClick={() => setView('monitor')}
        >
          {t('tabs.monitor')}
        </button>
        <button
          className={styles.viewBtn}
          data-active={view === 'scrollback'}
          onClick={() => setView('scrollback')}
        >
          {t('tabs.scrollback')}
        </button>
        <button
          className={styles.viewBtn}
          data-active={view === 'ssh'}
          onClick={() => setView('ssh')}
        >
          {t('tabs.ssh')}
        </button>
        <button
          className={styles.viewBtn}
          data-active={view === 'servers'}
          onClick={() => setView('servers')}
        >
          {t('tabs.servers')}
        </button>
      </div>

      {view === 'sessions' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>{t('sessions.title')}</span>
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
              <div className={styles.empty}>{t('common.loading')}</div>
            )}
            {!loading && sessions.length === 0 && (
              <div className={styles.empty}>{t('sessions.noSessionsTitle')}</div>
            )}
            {error && (
              <div className={styles.error}>{error}</div>
            )}
            {sortedSessions.map((session) => (
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
                    <button
                      className={styles.bookmarkBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(session.name);
                      }}
                      aria-label={bookmarked.has(session.name) ? t('sessions.unbookmark') : t('sessions.bookmark')}
                    >
                      {bookmarked.has(session.name) ? '★' : '☆'}
                    </button>
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
                      aria-label={t('common.delete')}
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
      {view === 'monitor' && <SystemMonitor visible={true} />}
      {view === 'scrollback' && <ScrollbackPanel />}
      {view === 'ssh' && <SshQuickConnect onConnected={() => setView('sessions')} />}
      {view === 'servers' && <ServerManager />}
      {deletingId && (
        <ConfirmDialog
          title={t('sessions.deleteSessionTitle')}
          message={t('sessions.deleteSessionConfirm', { name: deletingId?.replace(/^zen_/, '') })}
          confirmLabel={t('common.delete')}
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </aside>
  );
}
