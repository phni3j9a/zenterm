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
  // 状態ごとに専用の subtle 背景を敷く。success は primary (選択状態) とは
  // 別系統の若竹色なので、稼働状態と選択状態が並んでも見分けられる。
  // 文字は ink (12px の状態色文字は淡い subtle 上で AA を満たせない)、
  // 状態色はアイコンに乗せる (非テキスト 3:1 はどの組でも満たす)。
  const bg = {
    neutral: tokens.colors.surface,
    success: tokens.colors.successSubtle,
    warning: tokens.colors.warningSubtle,
    error: tokens.colors.errorSubtle,
    info: tokens.colors.infoSubtle,
  }[tone];
  const iconColor = {
    neutral: tokens.colors.textSecondary,
    success: tokens.colors.success,
    warning: tokens.colors.warning,
    error: tokens.colors.error,
    info: tokens.colors.info,
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
        color: tone === 'neutral' ? tokens.colors.textSecondary : tokens.colors.textPrimary,
        borderRadius: 999,
        fontSize: tokens.typography.small.fontSize,
        fontWeight: 500,
        border: tone === 'neutral' ? `1px solid ${tokens.colors.borderSubtle}` : '1px solid transparent',
      }}
    >
      {icon && (
        <span aria-hidden style={{ display: 'inline-flex', color: iconColor }}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
