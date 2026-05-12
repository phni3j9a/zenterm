import { useTheme } from '@/theme';

export interface SpinnerProps {
  size?: number;
  'aria-label'?: string;
}

export function Spinner({ size = 16, 'aria-label': label = 'Loading' }: SpinnerProps) {
  const { tokens } = useTheme();
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${tokens.colors.borderSubtle}`,
        borderTopColor: tokens.colors.primary,
        borderRadius: '50%',
        animation: 'zen-spin 0.6s linear infinite',
      }}
    />
  );
}
