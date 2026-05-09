import { useState } from 'react';
import type { TmuxSession } from '@zenterm/shared';
import { useTheme } from '@/theme';

export interface SessionsListPanelProps {
  sessions: TmuxSession[];
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
}

export function SessionsListPanel({
  sessions,
  activeSessionId,
  activeWindowIndex,
  onSelect,
}: SessionsListPanelProps) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div style={{ padding: tokens.spacing.md, color: tokens.colors.textPrimary }}>
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
      {sessions.map((session) => {
        const isActive = session.displayName === activeSessionId;
        const hasWindows = (session.windows?.length ?? 0) > 1;
        const isExpanded = expanded.has(session.name);
        return (
          <div key={session.name}>
            <button
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(session.displayName, undefined)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: tokens.spacing.sm,
                padding: tokens.spacing.sm,
                margin: 0,
                background: isActive ? tokens.colors.primarySubtle : 'transparent',
                color: tokens.colors.textPrimary,
                border: 'none',
                borderRadius: tokens.radii.sm,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: tokens.colors.success,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: tokens.typography.bodyMedium.fontSize }}>
                  {session.displayName}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.small.fontSize,
                    color: tokens.colors.textMuted,
                    fontFamily: tokens.typography.mono.fontFamily,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={session.cwd}
                >
                  {session.cwd}
                </span>
              </span>
              {hasWindows && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={isExpanded ? 'Collapse windows' : 'Expand windows'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(session.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(session.name);
                    }
                  }}
                  style={{
                    padding: tokens.spacing.xs,
                    color: tokens.colors.textMuted,
                    cursor: 'pointer',
                    fontSize: tokens.typography.caption.fontSize,
                  }}
                >
                  {isExpanded ? '▾' : '▸'}
                </span>
              )}
            </button>
            {isExpanded && session.windows && (
              <div style={{ paddingLeft: tokens.spacing.lg, borderLeft: `1px solid ${tokens.colors.borderSubtle}`, marginLeft: tokens.spacing.md }}>
                {session.windows.map((w) => {
                  const isWindowActive =
                    isActive && activeWindowIndex === w.index;
                  return (
                    <button
                      key={w.index}
                      type="button"
                      aria-current={isWindowActive ? 'true' : undefined}
                      onClick={() => onSelect(session.displayName, w.index)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: tokens.spacing.xs,
                        background: isWindowActive ? tokens.colors.primarySubtle : 'transparent',
                        border: 'none',
                        color: tokens.colors.textSecondary,
                        cursor: 'pointer',
                        fontSize: tokens.typography.smallMedium.fontSize,
                      }}
                    >
                      {w.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
