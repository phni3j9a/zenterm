// Ported from app/src/theme/tokens.ts (Zen Garden palette).
// Keep keys aligned with the mobile app so designers can port styles.
//
// Zen Garden — 和紙 × 墨 × 苔
//   Light: 和紙 (#F2F1EC) の上に、ほぼ白のカード (#FCFBF8) が浮かぶ。
//          チップや入力面はカードより一段「沈む」(surface < bg < bgElevated)。
//   Dark:  墨 (#191815) の中に面が灯る。面は明るいほど手前
//          (surfaceSunken < bg < bgElevated < surface < surfaceHover)。
// 状態色は日本の伝統色: 苔=primary / 若竹=success / 山吹=warning / 朱=error / 藍=info。
// success と primary は意図的に別系統 (選択状態と稼働状態を見分けるため)。

export const FONT_FAMILY_MONO =
  '"Noto Sans Mono CJK JP", "Noto Sans Mono", "DejaVu Sans Mono", monospace';

// xterm 領域専用。OS ネイティブの monospace に任せて ambiguous-width 文字 (例: ✻ Claude Code ロゴ) の
// 描画ズレを回避する。CJK は per-character font fallback で fontconfig / OS が解決する。
export const FONT_FAMILY_TERMINAL =
  'ui-monospace, "Cascadia Code", Menlo, Consolas, "DejaVu Sans Mono", monospace';

export interface ColorTokens {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  surfaceSunken: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  primarySubtle: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  error: string;
  errorSubtle: string;
  info: string;
  infoSubtle: string;
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
    // overline は style へ spread される前提なので lineHeight は倍率
    // (素の number は CSS で multiplier 扱い。px のつもりで 14 と書くと 14 倍になる)
    overline: { fontSize: number; lineHeight: number; fontWeight: 600; letterSpacing: string; textTransform: 'uppercase' };
    heading: { fontSize: number; lineHeight: number; fontWeight: 600 };
    mono: { fontFamily: string };
  };
  shadows: { sm: string; md: string; lg: string };
}

export const darkTokens: ThemeTokens = {
  colors: {
    bg: '#191815',
    bgElevated: '#232220',
    surface: '#2A2925',
    surfaceHover: '#34322D',
    surfaceActive: '#3B3933',
    surfaceSunken: '#121110',
    border: '#46443C',
    borderSubtle: '#353330',
    textPrimary: '#E4E0D4',
    textSecondary: '#A8A293',
    textMuted: '#958F81',
    textInverse: '#191815',
    primary: '#A6BA98',
    primaryHover: '#B5C7A8',
    primaryMuted: '#8FA681',
    primarySubtle: '#2E3628',
    success: '#7FB792',
    successSubtle: '#24332A',
    warning: '#D9B45F',
    warningSubtle: '#383017',
    // iOS (#D96C5C) より一段明るい朱。Web は 12px の朱テキストをカード面に
    // 直接乗せる箇所があり、AA 4.5:1 にはこの明度が必要 (axe 検証済み)。
    error: '#E28172',
    errorSubtle: '#3E2620',
    info: '#85AECE',
    infoSubtle: '#1F2E3D',
    overlay: 'rgba(9, 9, 7, 0.60)',
    focusRing: '#A6BA98',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48 },
  radii: { sm: 8, md: 12, lg: 16 },
  typography: {
    bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: 500 },
    smallMedium: { fontSize: 13, lineHeight: 18, fontWeight: 500 },
    small: { fontSize: 12, lineHeight: 16, fontWeight: 400 },
    caption: { fontSize: 11, lineHeight: 14, fontWeight: 400 },
    overline: { fontSize: 11, lineHeight: 1.3, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' },
    heading: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
    mono: { fontFamily: FONT_FAMILY_MONO },
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.25)',
    md: '0 4px 14px rgba(0, 0, 0, 0.35)',
    lg: '0 16px 44px rgba(0, 0, 0, 0.50)',
  },
};

export const lightTokens: ThemeTokens = {
  colors: {
    bg: '#F2F1EC',
    bgElevated: '#FCFBF8',
    surface: '#ECEAE3',
    surfaceHover: '#E6E4DC',
    surfaceActive: '#DFDCD3',
    surfaceSunken: '#D9D6CC',
    border: '#D6D3C8',
    borderSubtle: '#E5E3DA',
    textPrimary: '#26231D',
    textSecondary: '#5F5A4B',
    textMuted: '#6E6857',
    textInverse: '#F7F6F2',
    primary: '#5C7150',
    primaryHover: '#516447',
    primaryMuted: '#7E9070',
    primarySubtle: '#E6ECE0',
    success: '#4E8A62',
    successSubtle: '#E2EFE5',
    // iOS (#A8842D) より深い山吹。レート制限の % など 12px の警告テキストが
    // カード面に乗るため AA 4.5:1 を満たす濃度 (terminal ANSI yellow と同値)。
    warning: '#8A6A14',
    warningSubtle: '#F5EEDA',
    error: '#BC4B3C',
    errorSubtle: '#F7E6E2',
    info: '#51789B',
    infoSubtle: '#E4EDF4',
    overlay: 'rgba(38, 35, 29, 0.45)',
    focusRing: '#5C7150',
  },
  spacing: darkTokens.spacing,
  radii: darkTokens.radii,
  typography: darkTokens.typography,
  shadows: {
    sm: '0 1px 2px rgba(59, 53, 40, 0.10), 0 1px 3px rgba(59, 53, 40, 0.06)',
    md: '0 4px 12px rgba(59, 53, 40, 0.12), 0 2px 4px rgba(59, 53, 40, 0.06)',
    lg: '0 16px 40px rgba(59, 53, 40, 0.18), 0 4px 12px rgba(59, 53, 40, 0.08)',
  },
};
