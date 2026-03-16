export type ThemeMode = 'system' | 'light' | 'dark';

// Light Mode Colors
export const colors = {
  bg: '#FDFCFA',
  surface: '#F5F3EE',
  surfaceHover: '#EDEAE3',
  surfaceActive: '#E5E1D8',
  border: '#E0DCD4',
  borderSubtle: '#EDEBE6',

  textPrimary: '#2C2A25',
  textSecondary: '#706C63',
  textMuted: '#9E998F',
  textInverse: '#FDFCFA',

  primary: '#D4713D',
  primaryHover: '#BE6335',
  primaryActive: '#A8572F',
  primarySubtle: '#FDF0E9',
  primaryMuted: '#E8A882',

  success: '#5A8A5E',
  successSubtle: '#EFF5F0',
  warning: '#C49830',
  warningSubtle: '#FBF5E6',
  error: '#C44D4D',
  errorSubtle: '#FCEAEA',
  info: '#5B8FB9',
  infoSubtle: '#EBF3FA',

  overlay: 'rgba(44, 42, 37, 0.4)',
  focus: 'rgba(212, 113, 61, 0.4)',
  skeleton: '#EDEBE6',
  skeletonHighlight: '#F5F3EE',
} as const;

// Dark Mode Colors
export const colorsDark = {
  bg: '#1A1915',
  surface: '#24211D',
  surfaceHover: '#2F2B25',
  surfaceActive: '#3A3630',
  border: '#4B443A',
  borderSubtle: '#342F28',

  textPrimary: '#E8E4DC',
  textSecondary: '#B7AFA2',
  textMuted: '#7A7268',
  textInverse: '#1A1915',

  primary: '#E08B5A',
  primaryHover: '#E9A376',
  primaryActive: '#D4713D',
  primarySubtle: '#332520',
  primaryMuted: '#8B5D3A',

  success: '#8CB369',
  successSubtle: '#1E2A1A',
  warning: '#E0A458',
  warningSubtle: '#2A2518',
  error: '#D45D5D',
  errorSubtle: '#2E1C1C',
  info: '#6FA3CC',
  infoSubtle: '#1A2530',

  overlay: 'rgba(0, 0, 0, 0.5)',
  focus: 'rgba(224, 139, 90, 0.4)',
  skeleton: '#2F2B25',
  skeletonHighlight: '#3A3630',
} as const;

// Terminal Colors (常にダーク)
export const terminalColors = {
  bg: '#1A1915',
  foreground: '#E8E4DC',
  cursor: '#D97757',
  selection: 'rgba(217, 119, 87, 0.3)',
} as const;

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
    shadowColor: '#2C2A25',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#2C2A25',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#2C2A25',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
} as const;
