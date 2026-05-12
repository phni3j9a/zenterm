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
  const { tokens } = useTheme();
  const padPx = { sm: tokens.spacing.sm, md: tokens.spacing.lg, lg: tokens.spacing['2xl'] }[padding];
  const shadow = variant === 'elevated' ? tokens.shadows.sm : 'none';
  const border = variant === 'outline' ? `1px solid ${tokens.colors.border}` : 'none';
  const hasLabel = !!aria['aria-label'] || !!aria['aria-labelledby'];
  return (
    <div
      role={hasLabel ? 'region' : undefined}
      data-variant={variant}
      {...aria}
      style={{
        background: tokens.colors.bgElevated,
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
