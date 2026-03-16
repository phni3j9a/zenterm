import { colorsDark } from '@/src/theme/tokens';

const scheme = {
  text: colorsDark.textPrimary,
  background: colorsDark.bg,
  tint: colorsDark.primary,
  icon: colorsDark.textMuted,
  tabIconDefault: colorsDark.textMuted,
  tabIconSelected: colorsDark.primary,
  card: colorsDark.surface,
  cardMuted: colorsDark.surfaceHover,
  border: colorsDark.border,
  muted: colorsDark.textSecondary,
  danger: colorsDark.error,
  success: colorsDark.success,
};

const Colors = {
  light: scheme,
  dark: scheme,
};

export type AppColorScheme = typeof scheme;

export default Colors;
