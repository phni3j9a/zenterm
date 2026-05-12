import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { useTheme } from '@/theme';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode;
  label: string;
  variant?: 'ghost' | 'outline' | 'primary' | 'danger';
  size?: 'sm' | 'md';
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', style, ...rest }: IconButtonProps) {
  const { tokens } = useTheme();
  const dim = size === 'sm' ? 28 : 36;
  const bg = {
    ghost: 'transparent',
    outline: 'transparent',
    primary: tokens.colors.primary,
    danger: 'transparent',
  }[variant];
  const fg = {
    ghost: tokens.colors.textSecondary,
    outline: tokens.colors.textPrimary,
    primary: tokens.colors.textInverse,
    danger: tokens.colors.error,
  }[variant];
  const border =
    variant === 'outline'
      ? `1px solid ${tokens.colors.border}`
      : variant === 'danger'
        ? `1px solid ${tokens.colors.error}`
        : 'none';
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        {...rest}
        style={{
          width: dim,
          height: dim,
          background: bg,
          color: fg,
          border,
          borderRadius: tokens.radii.md,
          cursor: rest.disabled ? 'not-allowed' : 'pointer',
          opacity: rest.disabled ? 0.5 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
