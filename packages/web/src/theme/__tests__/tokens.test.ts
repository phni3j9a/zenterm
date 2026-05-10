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
