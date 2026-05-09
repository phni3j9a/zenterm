import { describe, expect, it } from 'vitest';
import { terminalColorsDark, terminalColorsLight } from '../terminalColors';

describe('terminalColors', () => {
  it('dark theme has all ANSI colors', () => {
    const required = [
      'background', 'foreground', 'cursor', 'cursorAccent', 'selectionBackground',
      'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
      'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
      'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
    ];
    for (const key of required) {
      expect(terminalColorsDark[key as keyof typeof terminalColorsDark]).toBeTruthy();
    }
  });

  it('light theme has same keys as dark', () => {
    expect(Object.keys(terminalColorsLight).sort()).toEqual(
      Object.keys(terminalColorsDark).sort(),
    );
  });
});
