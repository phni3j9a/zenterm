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
  const { tokens } = useTheme();
  const padY = size === 'sm' ? tokens.spacing.xl : tokens.spacing['4xl'];
  return (
    <div
      role="status"
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
            width: size === 'sm' ? 64 : 84,
            height: size === 'sm' ? 64 : 84,
            borderRadius: '50%',
            background: tokens.colors.primarySubtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: size === 'sm' ? 46 : 60,
              height: size === 'sm' ? 46 : 60,
              borderRadius: '50%',
              background: tokens.colors.bgElevated,
              border: `1px solid ${tokens.colors.borderSubtle}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tokens.colors.primaryMuted,
              fontSize: 32,
            }}
          >
            {icon}
          </div>
        </div>
      )}
      <div style={{ fontSize: tokens.typography.heading.fontSize, fontWeight: 600, color: tokens.colors.textSecondary }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: tokens.typography.small.fontSize, maxWidth: 320 }}>{description}</div>
      )}
      {action && <div style={{ marginTop: tokens.spacing.sm }}>{action}</div>}
    </div>
  );
}
