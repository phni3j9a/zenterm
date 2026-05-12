import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  const { tokens } = useTheme();
  const bg = {
    neutral: tokens.colors.surface,
    success: tokens.colors.primarySubtle,
    warning: tokens.colors.surface,
    error: tokens.colors.surface,
    info: tokens.colors.surface,
  }[tone];
  const fg = {
    neutral: tokens.colors.textSecondary,
    success: tokens.colors.primary,
    warning: tokens.colors.warning,
    error: tokens.colors.error,
    info: tokens.colors.textSecondary,
  }[tone];
  return (
    <span
      data-tone={tone}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: tokens.spacing.xs,
        padding: `2px ${tokens.spacing.sm}px`,
        background: bg,
        color: fg,
        borderRadius: 999,
        fontSize: tokens.typography.small.fontSize,
        fontWeight: 500,
        border: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      {icon && (
        <span aria-hidden style={{ display: 'inline-flex' }}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
