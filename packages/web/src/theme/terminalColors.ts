// Ported from server/packages/gateway/public/terminal/index.html (themes object).
// Keep these in sync if the embed terminal palette is ever updated.

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
  background: '#1B1A17',
  foreground: '#DBD6C8',
  cursor: '#94A687',
  cursorAccent: '#1B1A17',
  selectionBackground: 'rgba(148, 166, 135, 0.25)',
  black: '#1B1A17',
  red: '#C46A6A',
  green: '#94A687',
  yellow: '#D4B86A',
  blue: '#8EB0C4',
  magenta: '#b585b8',
  cyan: '#6fb5b5',
  white: '#c8c3b8',
  brightBlack: '#6D6860',
  brightRed: '#D48080',
  brightGreen: '#A5B59A',
  brightYellow: '#E0C87E',
  brightBlue: '#A0C0D4',
  brightMagenta: '#cda0d0',
  brightCyan: '#88cccc',
  brightWhite: '#F5F2EB',
};

export const terminalColorsLight: TerminalColorTheme = {
  background: '#F5F4F0',
  foreground: '#2A2721',
  cursor: '#7B8B6F',
  cursorAccent: '#F5F4F0',
  selectionBackground: 'rgba(123, 139, 111, 0.18)',
  black: '#2A2721',
  red: '#B25A5A',
  green: '#7B8B6F',
  yellow: '#B89F56',
  blue: '#7A96A8',
  magenta: '#8a5a8d',
  cyan: '#4a8a8a',
  white: '#A09C94',
  brightBlack: '#66614F',
  brightRed: '#B25A5A',
  brightGreen: '#7B8B6F',
  brightYellow: '#B89F56',
  brightBlue: '#7A96A8',
  brightMagenta: '#9b6b9e',
  brightCyan: '#5a9e9e',
  brightWhite: '#857f77',
};
