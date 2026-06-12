// Ported from server/packages/gateway/public/terminal/index.html (themes object).
// Keep these in sync if the embed terminal palette is ever updated.
//
// Zen Garden terminal palette:
//   light = 和紙 (#F7F6F1 — アプリ背景よりわずかに明るい紙) に墨文字
//   dark  = 墨 (#191815) に生成り文字
// ANSI 8 色は UI の状態色と同系統 (朱/若竹/山吹/藍) で、light 側は
// 細いグリフでも読めるよう全色 4.5:1 以上を確保している。

export interface TerminalColorTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const terminalColorsDark: TerminalColorTheme = {
  background: '#191815',
  foreground: '#E4E0D4',
  cursor: '#A6BA98',
  cursorAccent: '#191815',
  selectionBackground: 'rgba(166, 186, 152, 0.28)',
  black: '#191815',
  red: '#D96C5C',
  green: '#7FB792',
  yellow: '#D9B45F',
  blue: '#85AECE',
  magenta: '#C193C4',
  cyan: '#7FBFB8',
  white: '#CDC8BB',
  brightBlack: '#6F6A5E',
  brightRed: '#E58877',
  brightGreen: '#9ACBA8',
  brightYellow: '#E5C77F',
  brightBlue: '#A3C4DE',
  brightMagenta: '#D4ACD6',
  brightCyan: '#9AD3CC',
  brightWhite: '#F4F1E8',
};

export const terminalColorsLight: TerminalColorTheme = {
  background: '#F7F6F1',
  foreground: '#26231D',
  cursor: '#5C7150',
  cursorAccent: '#F7F6F1',
  selectionBackground: 'rgba(92, 113, 80, 0.20)',
  black: '#26231D',
  red: '#B0432F',
  green: '#447A52',
  yellow: '#8A6A14',
  blue: '#46698B',
  magenta: '#85567F',
  cyan: '#377776',
  white: '#A5A096',
  brightBlack: '#5F5A4B',
  brightRed: '#B0432F',
  brightGreen: '#447A52',
  brightYellow: '#8A6A14',
  brightBlue: '#46698B',
  brightMagenta: '#85567F',
  brightCyan: '#377776',
  brightWhite: '#857F73',
};
