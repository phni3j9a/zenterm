const palette = {
  background: '#1a1915',
  surface: '#24211d',
  surfaceMuted: '#2f2b25',
  text: '#e8e4dc',
  muted: '#b7afa2',
  tint: '#d97757',
  border: '#4b443a',
  danger: '#d45d5d',
  success: '#8cb369',
};

const scheme = {
  text: palette.text,
  background: palette.background,
  tint: palette.tint,
  icon: palette.muted,
  tabIconDefault: palette.muted,
  tabIconSelected: palette.tint,
  card: palette.surface,
  cardMuted: palette.surfaceMuted,
  border: palette.border,
  muted: palette.muted,
  danger: palette.danger,
  success: palette.success,
};

const Colors = {
  light: scheme,
  dark: scheme,
};

export type AppColorScheme = typeof scheme;

export default Colors;
