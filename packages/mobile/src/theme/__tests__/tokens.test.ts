import { terminalColors, terminalColorsLight, terminalColorsDark } from '../tokens';

describe('terminalColors tokens', () => {
  it('terminalColorsLight has all required keys', () => {
    expect(terminalColorsLight).toHaveProperty('bg');
    expect(terminalColorsLight).toHaveProperty('foreground');
    expect(terminalColorsLight).toHaveProperty('cursor');
    expect(terminalColorsLight).toHaveProperty('cursorAccent');
    expect(terminalColorsLight).toHaveProperty('selection');
  });

  it('terminalColorsDark has all required keys', () => {
    expect(terminalColorsDark).toHaveProperty('bg');
    expect(terminalColorsDark).toHaveProperty('foreground');
    expect(terminalColorsDark).toHaveProperty('cursor');
    expect(terminalColorsDark).toHaveProperty('cursorAccent');
    expect(terminalColorsDark).toHaveProperty('selection');
  });

  it('terminalColors is backward-compatible alias for terminalColorsDark', () => {
    expect(terminalColors).toBe(terminalColorsDark);
  });

  it('light and dark themes have different bg colors', () => {
    expect(terminalColorsLight.bg).not.toBe(terminalColorsDark.bg);
  });

  it('light bg is lighter than dark bg', () => {
    // Light bg starts with #FD..., Dark bg starts with #1A...
    const lightVal = parseInt(terminalColorsLight.bg.slice(1, 3), 16);
    const darkVal = parseInt(terminalColorsDark.bg.slice(1, 3), 16);
    expect(lightVal).toBeGreaterThan(darkVal);
  });

  it('light foreground is darker than dark foreground', () => {
    const lightVal = parseInt(terminalColorsLight.foreground.slice(1, 3), 16);
    const darkVal = parseInt(terminalColorsDark.foreground.slice(1, 3), 16);
    expect(lightVal).toBeLessThan(darkVal);
  });

  it('cursorAccent matches bg for both themes', () => {
    expect(terminalColorsLight.cursorAccent).toBe(terminalColorsLight.bg);
    expect(terminalColorsDark.cursorAccent).toBe(terminalColorsDark.bg);
  });

  it('selection values contain rgba', () => {
    expect(terminalColorsLight.selection).toMatch(/^rgba\(/);
    expect(terminalColorsDark.selection).toMatch(/^rgba\(/);
  });
});
