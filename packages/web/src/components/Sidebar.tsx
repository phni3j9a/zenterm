import type { TmuxSession } from '@zenterm/shared';
import { SessionsListPanel } from './SessionsListPanel';
import { useTheme } from '@/theme';

export interface SidebarProps {
  sessions: TmuxSession[];
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
}

const SIDEBAR_WIDTH = 320;

export function Sidebar({
  sessions,
  activeSessionId,
  activeWindowIndex,
  onSelect,
}: SidebarProps) {
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
      <div
        aria-label="Sessions panel"
        style={{ overflowY: 'auto' }}
      >
        <SessionsListPanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          activeWindowIndex={activeWindowIndex}
          onSelect={onSelect}
        />
      </div>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          borderTop: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
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
          title="Coming in Phase 2"
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
          title="Coming in Phase 2"
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
      </nav>
    </aside>
  );
}
