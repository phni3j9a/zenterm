import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { SessionsListPanel } from './SessionsListPanel';
import { useTheme } from '@/theme';
import { useEventsStore } from '@/stores/events';

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

export function Sidebar(props: SidebarProps) {
  const { tokens } = useTheme();
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
      <div aria-label="Sessions panel" style={{ overflowY: 'auto' }}>
        <SessionsListPanel {...props} />
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
          aria-pressed="true"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.primary,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'pointer',
            padding: tokens.spacing.sm,
          }}
        >
          ⌘ Sessions
        </button>
        <button
          type="button"
          aria-label="Files tab"
          disabled
          title="Coming in Phase 2b"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          📁 Files
        </button>
        <button
          type="button"
          aria-label="Settings tab"
          disabled
          title="Coming in Phase 2b"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          ⚙ Settings
        </button>
        <EventsStatusDot />
      </nav>
    </aside>
  );
}

function EventsStatusDot() {
  const { tokens } = useTheme();
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
  const label =
    status === 'reconnecting'
      ? `Realtime updates: reconnecting (attempt ${attempt})`
      : `Realtime updates: ${status}`;
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
