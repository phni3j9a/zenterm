import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { usePaneStore } from '@/stores/pane';
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const panes = usePaneStore((s) => s.panes);
  const focusedIndex = usePaneStore((s) => s.focusedIndex);
  const assignPane = usePaneStore((s) => s.assignPane);

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
          {t('common.loading')}
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
          <span>{t('sessions.loadFailed', { error })}</span>
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
          {t('sessions.empty')}
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
                  const target = { sessionId: session.displayName, windowIndex: w.index };
                  const occupyingIdx = panes.findIndex(
                    (p) =>
                      p !== null &&
                      p.sessionId === target.sessionId &&
                      p.windowIndex === target.windowIndex,
                  );
                  const isOccupiedElsewhere =
                    occupyingIdx !== -1 && occupyingIdx !== focusedIndex;
                  const openInPaneOptions = panes
                    .map((_, i) => i)
                    .filter((i) => i !== focusedIndex && i !== occupyingIdx);
                  const isWindowActive =
                    isActive && activeWindowIndex === w.index;
                  return (
                    <WindowRow
                      key={w.index}
                      sessionDisplayName={session.displayName}
                      window={w}
                      isActive={isWindowActive}
                      isOccupiedElsewhere={isOccupiedElsewhere}
                      openInPaneOptions={openInPaneOptions}
                      onSelect={() => onSelect(session.displayName, w.index)}
                      onRename={onRenameWindow}
                      onRequestDelete={onRequestDeleteWindow}
                      onOpenInPane={(idx) => assignPane(idx, target)}
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
