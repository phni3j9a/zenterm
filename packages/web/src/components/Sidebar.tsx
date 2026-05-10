import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SessionsListPanel } from './SessionsListPanel';
import { SettingsPanel } from './settings/SettingsPanel';
import { useTheme } from '@/theme';
import { useEventsStore } from '@/stores/events';

type ActivePanel = 'sessions' | 'files' | 'settings';

export interface SidebarProps {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
  onCreateSession: (name?: string) => void | Promise<void>;
  onRenameSession: (currentDisplayName: string, newName: string) => void | Promise<void>;
  onRequestDeleteSession: (session: TmuxSession) => void;
  onCreateWindow: (sessionDisplayName: string, name?: string) => void | Promise<void>;
  onRenameWindow: (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ) => void | Promise<void>;
  onRequestDeleteWindow: (sessionDisplayName: string, window: TmuxWindow) => void;
}

const SIDEBAR_WIDTH = 320;

function deriveActivePanel(pathname: string): ActivePanel {
  if (pathname.startsWith('/web/settings')) return 'settings';
  if (pathname.startsWith('/web/files')) return 'files';
  return 'sessions';
}

export function Sidebar(props: SidebarProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const activePanel = deriveActivePanel(location.pathname);

  const renderPanel = () => {
    if (activePanel === 'settings') return <SettingsPanel />;
    return <SessionsListPanel {...props} />;
  };

  const tabButtonStyle = (active: boolean, disabled = false) => ({
    background: 'none' as const,
    border: 'none' as const,
    color: active
      ? tokens.colors.primary
      : disabled
        ? tokens.colors.textMuted
        : tokens.colors.textSecondary,
    fontSize: tokens.typography.caption.fontSize,
    cursor: disabled ? ('not-allowed' as const) : ('pointer' as const),
    padding: tokens.spacing.sm,
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        background: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'grid',
        gridTemplateRows: '1fr 56px',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div aria-label={`${activePanel} panel`} style={{ overflowY: 'auto' }}>
        {renderPanel()}
      </div>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          borderTop: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Sessions tab"
          aria-pressed={activePanel === 'sessions'}
          onClick={() => navigate('/web/sessions')}
          style={tabButtonStyle(activePanel === 'sessions')}
        >
          ⌘ {t('sidebar.tabs.sessions')}
        </button>
        <button
          type="button"
          aria-label="Files tab"
          aria-pressed={activePanel === 'files'}
          disabled
          title={t('sidebar.filesComingSoon')}
          style={tabButtonStyle(activePanel === 'files', true)}
        >
          📁 {t('sidebar.tabs.files')}
        </button>
        <button
          type="button"
          aria-label="Settings tab"
          aria-pressed={activePanel === 'settings'}
          onClick={() => navigate('/web/settings')}
          style={tabButtonStyle(activePanel === 'settings')}
        >
          ⚙ {t('sidebar.tabs.settings')}
        </button>
        <EventsStatusDot />
      </nav>
    </aside>
  );
}

function EventsStatusDot() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const status = useEventsStore((s) => s.status);
  const attempt = useEventsStore((s) => s.reconnectAttempt);
  const color = (() => {
    switch (status) {
      case 'connected':
        return tokens.colors.success;
      case 'reconnecting':
        return tokens.colors.warning;
      case 'failed':
        return tokens.colors.error;
      default:
        return tokens.colors.textMuted;
    }
  })();
  const label = (() => {
    switch (status) {
      case 'connected':
        return t('sidebar.events.connected');
      case 'reconnecting':
        return t('sidebar.events.reconnecting', { attempt });
      case 'failed':
        return t('sidebar.events.failed');
      default:
        return t('sidebar.events.disconnected');
    }
  })();
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}
