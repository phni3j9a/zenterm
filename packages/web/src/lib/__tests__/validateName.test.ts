import { describe, expect, it } from 'vitest';
import { validateSessionOrWindowName } from '../validateName';

describe('validateSessionOrWindowName', () => {
  it('returns null for valid names', () => {
    expect(validateSessionOrWindowName('zen_dev')).toBeNull();
    expect(validateSessionOrWindowName('main-2')).toBeNull();
    expect(validateSessionOrWindowName('w0')).toBeNull();
  });

  it('returns "empty" for empty / whitespace-only', () => {
    expect(validateSessionOrWindowName('')).toBe('empty');
    expect(validateSessionOrWindowName('   ')).toBe('empty');
  });

  it('returns "too-long" for names longer than 64 chars', () => {
    const long = 'a'.repeat(65);
    expect(validateSessionOrWindowName(long)).toBe('too-long');
  });

  it('returns "invalid-chars" for names with unsupported characters', () => {
    expect(validateSessionOrWindowName('foo bar')).toBe('invalid-chars');
    expect(validateSessionOrWindowName('foo.bar')).toBe('invalid-chars');
    expect(validateSessionOrWindowName('日本語')).toBe('invalid-chars');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateSessionOrWindowName('  ok  ')).toBeNull();
  });
});
