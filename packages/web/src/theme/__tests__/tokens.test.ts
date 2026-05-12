import { describe, expect, it } from 'vitest';
import { darkTokens, lightTokens } from '../tokens';

describe('design tokens', () => {
  it('darkTokens has core color slots', () => {
    expect(darkTokens.colors.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(darkTokens.colors.textPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(darkTokens.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(darkTokens.colors.error).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('lightTokens has same color keys', () => {
    expect(Object.keys(lightTokens.colors).sort()).toEqual(
      Object.keys(darkTokens.colors).sort(),
    );
  });

  it('spacing scale is monotonically increasing', () => {
    const values = [
      darkTokens.spacing.xs,
      darkTokens.spacing.sm,
      darkTokens.spacing.md,
      darkTokens.spacing.lg,
      darkTokens.spacing.xl,
    ];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

function relLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}
function ratio(a: string, b: string): number {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('tokens contrast', () => {
  for (const [name, t] of [['dark', darkTokens], ['light', lightTokens]] as const) {
    it(`${name}: textPrimary/bg >= 4.5`, () => {
      expect(ratio(t.colors.textPrimary, t.colors.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: textSecondary/surface >= 4.5`, () => {
      expect(ratio(t.colors.textSecondary, t.colors.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: textMuted/bgElevated >= 4.5`, () => {
      expect(ratio(t.colors.textMuted, t.colors.bgElevated)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('exports shadows.sm/md/lg', () => {
    expect(darkTokens.shadows.sm).toMatch(/rgba/);
    expect(darkTokens.shadows.md).toMatch(/rgba/);
    expect(darkTokens.shadows.lg).toMatch(/rgba/);
  });
  it('exports focusRing color', () => {
    expect(darkTokens.colors.focusRing).toMatch(/^#/);
    expect(lightTokens.colors.focusRing).toMatch(/^#/);
  });
  it('dark: focusRing has >= 3:1 contrast vs bg (WCAG AA non-text)', () => {
    expect(ratio(darkTokens.colors.focusRing, darkTokens.colors.bg)).toBeGreaterThanOrEqual(3);
  });
  it('light: focusRing has >= 3:1 contrast vs bg (WCAG AA non-text)', () => {
    expect(ratio(lightTokens.colors.focusRing, lightTokens.colors.bg)).toBeGreaterThanOrEqual(3);
  });
  it('dark: surfaceSunken is darker than bg (depth going inward)', () => {
    expect(relLuminance(darkTokens.colors.surfaceSunken)).toBeLessThan(relLuminance(darkTokens.colors.bg));
  });
  it('light: surfaceSunken is darker than surface (depth going inward)', () => {
    expect(relLuminance(lightTokens.colors.surfaceSunken)).toBeLessThan(relLuminance(lightTokens.colors.surface));
  });
});
