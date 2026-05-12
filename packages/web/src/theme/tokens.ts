// Ported from app/src/theme/tokens.ts (Zen palette).
// Keep keys aligned with the mobile app so designers can port styles.

export const FONT_FAMILY_MONO =
  '"Noto Sans Mono CJK JP", "Noto Sans Mono", "DejaVu Sans Mono", monospace';

export interface ColorTokens {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  surfaceSunken: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryMuted: string;
  primarySubtle: string;
  success: string;
  warning: string;
  error: string;
  overlay: string;
  focusRing: string;
}

export interface ThemeTokens {
  colors: ColorTokens;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  radii: { sm: number; md: number; lg: number };
  typography: {
    bodyMedium: { fontSize: number; lineHeight: number; fontWeight: 500 };
    smallMedium: { fontSize: number; lineHeight: number; fontWeight: 500 };
    small: { fontSize: number; lineHeight: number; fontWeight: 400 };
    caption: { fontSize: number; lineHeight: number; fontWeight: 400 };
    heading: { fontSize: number; lineHeight: number; fontWeight: 600 };
    mono: { fontFamily: string };
  };
  shadows: { sm: string; md: string; lg: string };
}

export const darkTokens: ThemeTokens = {
  colors: {
    bg: '#1B1A17',
    bgElevated: '#211F1B',
    surface: '#26241F',
    surfaceHover: '#302D27',
    surfaceSunken: '#161512',
    border: '#3B3832',
    borderSubtle: '#2A2823',
    textPrimary: '#DBD6C8',
    textSecondary: '#B0AB9B',
    textMuted: '#908A7E',
    textInverse: '#1B1A17',
    primary: '#94A687',
    primaryMuted: '#7B8B6F',
    primarySubtle: '#2C3328',
    success: '#94A687',
    warning: '#D4B86A',
    error: '#CC7070',
    overlay: 'rgba(11, 10, 8, 0.6)',
    focusRing: '#B6C8A4',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48 },
  radii: { sm: 6, md: 10, lg: 14 },
  typography: {
    bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: 500 },
    smallMedium: { fontSize: 13, lineHeight: 18, fontWeight: 500 },
    small: { fontSize: 12, lineHeight: 16, fontWeight: 400 },
    caption: { fontSize: 11, lineHeight: 14, fontWeight: 400 },
    heading: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
    mono: { fontFamily: FONT_FAMILY_MONO },
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.18)',
    md: '0 4px 12px rgba(0, 0, 0, 0.28)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.40)',
  },
};

export const lightTokens: ThemeTokens = {
  colors: {
    bg: '#F5F4F0',
    bgElevated: '#FBFAF6',
    surface: '#EFEDE7',
    surfaceHover: '#E5E3DC',
    surfaceSunken: '#E5E3DC',
    border: '#CFCBC1',
    borderSubtle: '#DEDBD2',
    textPrimary: '#2A2721',
    textSecondary: '#54504A',
    textMuted: '#736D60',
    textInverse: '#F5F4F0',
    primary: '#7B8B6F',
    primaryMuted: '#5C6E51',
    primarySubtle: '#E3E8DD',
    success: '#7B8B6F',
    warning: '#B89F56',
    error: '#B25A5A',
    overlay: 'rgba(35, 33, 28, 0.40)',
    focusRing: '#7B8B6F',
  },
  spacing: darkTokens.spacing,
  radii: darkTokens.radii,
  typography: darkTokens.typography,
  shadows: {
    sm: '0 1px 2px rgba(35, 33, 28, 0.08)',
    md: '0 4px 12px rgba(35, 33, 28, 0.12)',
    lg: '0 12px 32px rgba(35, 33, 28, 0.20)',
  },
};
