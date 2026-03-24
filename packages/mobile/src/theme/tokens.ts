export type ThemeMode = 'light' | 'dark';

// Light Mode Colors — Zen (subtle warmth + moss green)
export const colors = {
  bg: '#F5F4F0',
  surface: '#EEEDEA',
  surfaceHover: '#E7E6E2',
  surfaceActive: '#E0DFDB',
  border: '#D8D6D0',
  borderSubtle: '#EAE9E5',

  textPrimary: '#2A2721',
  textSecondary: '#66614F',
  textMuted: '#958E7E',
  textInverse: '#F5F4F0',

  primary: '#7B8B6F',
  primaryHover: '#6C7C61',
  primaryActive: '#5E6D54',
  primarySubtle: '#E8EDE4',
  primaryMuted: '#A4B199',

  success: '#7B8B6F',
  successSubtle: '#E8EDE4',
  warning: '#B89F56',
  warningSubtle: '#F5F0E0',
  error: '#B25A5A',
  errorSubtle: '#F5E6E6',
  info: '#7A96A8',
  infoSubtle: '#E8EFF4',

  overlay: 'rgba(42, 39, 33, 0.4)',
  focus: 'rgba(123, 139, 111, 0.4)',
  skeleton: '#EAE9E5',
  skeletonHighlight: '#EEEDEA',
} as const;

// Dark Mode Colors — Zen
export const colorsDark = {
  bg: '#1B1A17',
  surface: '#242320',
  surfaceHover: '#2E2D29',
  surfaceActive: '#383631',
  border: '#3A3832',
  borderSubtle: '#2E2D29',

  textPrimary: '#DBD6C8',
  textSecondary: '#A5A090',
  textMuted: '#6D6860',
  textInverse: '#1B1A17',

  primary: '#94A687',
  primaryHover: '#A5B59A',
  primaryActive: '#7B8B6F',
  primarySubtle: '#262B23',
  primaryMuted: '#4E5746',

  success: '#94A687',
  successSubtle: '#262B23',
  warning: '#D4B86A',
  warningSubtle: '#2A2719',
  error: '#C46A6A',
  errorSubtle: '#2E1F1F',
  info: '#8EB0C4',
  infoSubtle: '#1C2630',

  overlay: 'rgba(0, 0, 0, 0.5)',
  focus: 'rgba(148, 166, 135, 0.4)',
  skeleton: '#2E2D29',
  skeletonHighlight: '#383631',
} as const;

// Terminal Colors — Light (Zen)
export const terminalColorsLight = {
  bg: '#F5F4F0',
  foreground: '#2A2721',
  cursor: '#7B8B6F',
  cursorAccent: '#F5F4F0',
  selection: 'rgba(123, 139, 111, 0.18)',
} as const;

// Terminal Colors — Dark (Zen)
export const terminalColorsDark = {
  bg: '#1B1A17',
  foreground: '#DBD6C8',
  cursor: '#94A687',
  cursorAccent: '#1B1A17',
  selection: 'rgba(148, 166, 135, 0.25)',
} as const;

// Backward compat: terminalColors is an alias for terminalColorsDark
export const terminalColors = terminalColorsDark;

export type ColorTokens = {
  [Key in keyof typeof colors]: string;
};

export const typography = {
  screenTitle: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, letterSpacing: 0 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24, letterSpacing: 0 },
  caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, letterSpacing: 0.1 },
  captionMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, letterSpacing: 0.1 },
  small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0.2 },
  smallMedium: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.3 },
  mono: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: 'Menlo',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// Shadows (Light mode only)
export const shadows = {
  sm: {
    shadowColor: '#2A2721',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#2A2721',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#2A2721',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
} as const;
