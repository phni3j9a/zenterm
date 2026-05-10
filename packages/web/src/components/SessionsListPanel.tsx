import { useState } from 'react';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { SessionRow } from './sidebar/SessionRow';
import { WindowRow } from './sidebar/WindowRow';
import { NewSessionButton } from './sidebar/NewSessionButton';
import { NewWindowButton } from './sidebar/NewWindowButton';

export interface SessionsListPanelProps {
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

export function SessionsListPanel({
  sessions,
  loading,
  error,
  activeSessionId,
  activeWindowIndex,
  onSelect,
  onCreateSession,
  onRenameSession,
  onRequestDeleteSession,
  onCreateWindow,
  onRenameWindow,
  onRequestDeleteWindow,
}: SessionsListPanelProps) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div
      style={{
        padding: tokens.spacing.md,
        color: tokens.colors.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing.sm,
      }}
    >
      <div
        style={{
          fontSize: tokens.typography.caption.fontSize,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          color: tokens.colors.textMuted,
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        }}
      >
        Active · {sessions.length}
      </div>

      {loading && sessions.length === 0 && (
        <div style={{ padding: tokens.spacing.md, color: tokens.colors.textMuted }}>
          読み込み中…
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: tokens.spacing.md,
            color: tokens.colors.error,
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing.sm,
          }}
        >
          <span>読み込めませんでした: {error}</span>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div
          style={{
            padding: tokens.spacing.lg,
            color: tokens.colors.textMuted,
            textAlign: 'center',
          }}
        >
          セッションなし
        </div>
      )}

      {sessions.map((session) => {
        const isActive = session.displayName === activeSessionId;
        const isExpanded = expanded.has(session.name);
        return (
          <div key={session.name}>
            <SessionRow
              session={session}
              isActive={isActive}
              isExpanded={isExpanded}
              activeWindowIndex={activeWindowIndex}
              onSelect={onSelect}
              onToggleExpand={toggle}
              onRename={onRenameSession}
              onRequestDelete={onRequestDeleteSession}
            />
            {isExpanded && session.windows && (
              <div
                style={{
                  paddingLeft: tokens.spacing.lg,
                  borderLeft: `1px solid ${tokens.colors.borderSubtle}`,
                  marginLeft: tokens.spacing.md,
                }}
              >
                {session.windows.map((w) => {
                  const isWindowActive =
                    isActive && activeWindowIndex === w.index;
                  return (
                    <WindowRow
                      key={w.index}
                      sessionDisplayName={session.displayName}
                      window={w}
                      isActive={isWindowActive}
                      onSelect={() => onSelect(session.displayName, w.index)}
                      onRename={onRenameWindow}
                      onRequestDelete={onRequestDeleteWindow}
                    />
                  );
                })}
                <NewWindowButton
                  onCreate={(name) => onCreateWindow(session.displayName, name)}
                />
              </div>
            )}
          </div>
        );
      })}

      <NewSessionButton onCreate={onCreateSession} />
    </div>
  );
}
