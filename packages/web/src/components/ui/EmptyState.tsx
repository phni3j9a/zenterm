import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md';
}

export function EmptyState({ icon, title, description, action, size = 'md' }: EmptyStateProps) {
  const { tokens, resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const padY = size === 'sm' ? tokens.spacing.xl : tokens.spacing['4xl'];
  const outer = size === 'sm' ? 72 : 96;
  const inner = size === 'sm' ? 50 : 66;
  const rippleColor = dark ? 'rgba(166, 186, 152, 0.07)' : 'rgba(92, 113, 80, 0.08)';
  const ensoInk = dark ? 'rgba(166, 186, 152, 0.45)' : 'rgba(92, 113, 80, 0.40)';
  return (
    <div
      role="status"
      className="zen-rise"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacing.md,
        padding: `${padY}px ${tokens.spacing.lg}px`,
        textAlign: 'center',
        color: tokens.colors.textMuted,
      }}
    >
      {icon && (
        <div
          aria-hidden
          style={{
            position: 'relative',
            width: outer,
            height: outer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // 砂紋 — アイコンの周囲に静かに広がる同心円
            background: `repeating-radial-gradient(circle at center, transparent 0px, transparent ${size === 'sm' ? 10 : 13}px, ${rippleColor} ${size === 'sm' ? 10 : 13}px, ${rippleColor} ${size === 'sm' ? 11.5 : 14.5}px)`,
            borderRadius: '50%',
          }}
        >
          {/* 禅円 — 一筆書きの円。conic-gradient で筆の切れ目を残す */}
          <div
            style={{
              position: 'absolute',
              inset: (outer - inner) / 2 - 7,
              borderRadius: '50%',
              background: `conic-gradient(from 230deg, transparent 0deg, ${ensoInk} 50deg, ${ensoInk} 300deg, transparent 330deg)`,
              WebkitMask: 'radial-gradient(closest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px))',
              mask: 'radial-gradient(closest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px))',
            }}
          />
          <div
            style={{
              width: inner,
              height: inner,
              borderRadius: '50%',
              background: tokens.colors.primarySubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tokens.colors.primaryMuted,
            }}
          >
            {icon}
          </div>
        </div>
      )}
      <div
        className="zen-display"
        style={{
          fontSize: tokens.typography.heading.fontSize,
          fontWeight: 600,
          color: tokens.colors.textSecondary,
        }}
      >
        {title}
      </div>
      {description && (
        <div style={{ fontSize: tokens.typography.small.fontSize, maxWidth: 320, lineHeight: 1.6 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: tokens.spacing.sm }}>{action}</div>}
    </div>
  );
}
