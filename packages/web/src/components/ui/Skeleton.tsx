import { useTheme } from '@/theme';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
}

export function Skeleton({ width = '100%', height = 16, radius = 4 }: SkeletonProps) {
  const { tokens } = useTheme();
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width,
        height,
        background: tokens.colors.surface,
        borderRadius: radius,
      }}
    />
  );
}
