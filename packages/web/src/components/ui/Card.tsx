import type { ReactNode, CSSProperties } from 'react';
import { useTheme } from '@/theme';

export type CardVariant = 'elevated' | 'outline' | 'plain';
export interface CardProps {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  style?: CSSProperties;
}

export function Card({ variant = 'elevated', padding = 'md', children, style, ...aria }: CardProps) {
  const { tokens, resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const padPx = { sm: tokens.spacing.sm, md: tokens.spacing.lg, lg: tokens.spacing['2xl'] }[padding];
  const shadow = variant === 'elevated' ? tokens.shadows.sm : 'none';
  // ダークは影がほぼ効かないので「面の明るさ=高さ」で浮かせる。
  // bgElevated (サイドバー面) の上に置かれても一段明るい surface なら輪郭が出る。
  const background = dark ? tokens.colors.surface : tokens.colors.bgElevated;
  const border =
    variant === 'outline'
      ? `1px solid ${tokens.colors.border}`
      : variant === 'elevated'
        ? `1px solid ${tokens.colors.borderSubtle}`
        : 'none';
  const hasLabel = !!aria['aria-label'] || !!aria['aria-labelledby'];
  return (
    <div
      role={hasLabel ? 'region' : undefined}
      data-variant={variant}
      {...aria}
      style={{
        background,
        borderRadius: tokens.radii.lg,
        padding: padPx,
        boxShadow: shadow,
        border,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
