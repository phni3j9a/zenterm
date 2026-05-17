import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SessionsListPanel } from './SessionsListPanel';
import { SettingsPanel } from './settings/SettingsPanel';
import { FilesSidebarPanel } from './files/FilesSidebarPanel';
import type { FilesApiClient } from './files/filesApi';
import { LayoutSelector } from './terminal/LayoutSelector';
import { useTheme } from '@/theme';
import { useEventsStore } from '@/stores/events';
import { useLayoutStore } from '@/stores/layout';
import { SidebarResizer } from './sidebar/SidebarResizer';

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
  filesClient?: FilesApiClient;
}

function deriveActivePanel(pathname: string): ActivePanel {
  if (pathname.startsWith('/web/settings')) return 'settings';
  if (pathname.startsWith('/web/files')) return 'files';
  return 'sessions';
}

export function Sidebar(props: SidebarProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const activePanel = deriveActivePanel(location.pathname);
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);

  const renderPanel = () => {
    if (activePanel === 'settings') return <SettingsPanel />;
    if (activePanel === 'files' && props.filesClient)
      return <FilesSidebarPanel client={props.filesClient} />;
    return <SessionsListPanel {...props} />;
  };

  return (
    <aside
      role="complementary"
      aria-hidden={collapsed || undefined}
      style={{
        width: collapsed ? 0 : sidebarWidth,
        flexShrink: 0,
        background: tokens.colors.bgElevated,
        borderRight: collapsed ? 'none' : `1px solid ${tokens.colors.borderSubtle}`,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {collapsed ? null : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.spacing.sm,
              padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
              borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
            }}
          >
            <span
              style={{
                fontSize: tokens.typography.smallMedium.fontSize,
                color: tokens.colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              {t('terminal.layout.menuLabel')}
            </span>
            <LayoutSelector />
          </div>
          <div
            id={`panel-${activePanel}`}
            role="tabpanel"
            aria-label={`${activePanel} panel`}
            style={{ overflowY: 'auto' }}
          >
            {renderPanel()}
          </div>
          <SidebarResizer />
        </>
      )}
    </aside>
  );
}

export function EventsStatusDot() {
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
