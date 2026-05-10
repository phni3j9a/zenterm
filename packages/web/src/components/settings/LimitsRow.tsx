import { useState } from 'react';
import { useTheme } from '@/theme';

export interface LimitsRowWindow {
  shortLabel: string;
  percent: number;
  resetsInText: string;
}

interface Props {
  accountLabel?: string;
  windows: LimitsRowWindow[];
  stale?: boolean;
  staleText?: string;
}

const HIGH = 90;
const MID = 50;

export function LimitsRow({ accountLabel, windows, stale, staleText }: Props) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const expandable = windows.length > 0;
  const maxPercent = windows.reduce((m, w) => Math.max(m, w.percent), 0);

  const dotColor = maxPercent >= HIGH
    ? tokens.colors.error
    : maxPercent >= MID
      ? tokens.colors.warning
      : tokens.colors.primary;

  const percentColor = (p: number) => p >= HIGH ? tokens.colors.error : p >= MID ? tokens.colors.warning : tokens.colors.textPrimary;
  const barColor = (p: number) => p >= HIGH ? tokens.colors.error : p >= MID ? tokens.colors.warning : tokens.colors.primary;

  return (
    <div style={{ opacity: stale ? 0.78 : 1 }}>
      <button
        type="button"
        aria-expanded={expanded}
        disabled={!expandable}
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: tokens.spacing.sm,
          background: 'none', border: 'none',
          padding: `${tokens.spacing.xs}px 0`, width: '100%',
          cursor: expandable ? 'pointer' : 'default',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: dotColor }} />
        {accountLabel ? (
          <span style={{
            textTransform: 'uppercase', letterSpacing: '.04em',
            fontSize: 11, color: tokens.colors.textSecondary,
            minWidth: 36,
          }}>{accountLabel}</span>
        ) : null}
        <span style={{ display: 'flex', flex: 1, gap: tokens.spacing.md, flexWrap: 'wrap' }}>
          {windows.map((w) => {
            const p = Math.max(0, Math.min(100, w.percent));
            return (
              <span key={w.shortLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>{w.shortLabel}</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600, color: percentColor(p) }}>
                  {p.toFixed(0)}%
                </span>
              </span>
            );
          })}
        </span>
        {stale ? (
          <span aria-label="stale" style={{ width: 5, height: 5, borderRadius: 2.5, background: tokens.colors.warning }} />
        ) : null}
      </button>
      {expanded && expandable ? (
        <div style={{ paddingLeft: 16, paddingBottom: tokens.spacing.sm, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          {windows.map((w) => {
            const p = Math.max(0, Math.min(100, w.percent));
            return (
              <div key={w.shortLabel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: tokens.colors.textSecondary }}>{w.shortLabel}</span>
                  <span style={{ color: tokens.colors.textMuted }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', color: percentColor(p), marginRight: 6 }}>
                      {p.toFixed(1)}%
                    </span>
                    {'· '}
                    <span>{w.resetsInText}</span>
                  </span>
                </div>
                <div style={{ height: 4, background: tokens.colors.surface, borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${p}%`, height: '100%', background: barColor(p) }} />
                </div>
              </div>
            );
          })}
          {stale && staleText ? (
            <p style={{ fontSize: 11, color: tokens.colors.warning, fontStyle: 'italic', margin: 0 }}>{staleText}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
