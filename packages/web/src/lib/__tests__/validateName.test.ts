import { describe, expect, it } from 'vitest';
import { validateSessionOrWindowName } from '../validateName';

describe('validateSessionOrWindowName', () => {
  it('returns null for valid names', () => {
    expect(validateSessionOrWindowName('zen_dev')).toBeNull();
    expect(validateSessionOrWindowName('main-2')).toBeNull();
    expect(validateSessionOrWindowName('w0')).toBeNull();
  });

  it('rejects empty / whitespace-only', () => {
    expect(validateSessionOrWindowName('')).toBe('名前を入力してください');
    expect(validateSessionOrWindowName('   ')).toBe('名前を入力してください');
  });

  it('rejects names longer than 64 chars', () => {
    const long = 'a'.repeat(65);
    expect(validateSessionOrWindowName(long)).toBe('64 文字以内で入力してください');
  });

  it('rejects names with unsupported characters', () => {
    expect(validateSessionOrWindowName('foo bar')).toBe('英数字・_・- のみ使用できます');
    expect(validateSessionOrWindowName('foo.bar')).toBe('英数字・_・- のみ使用できます');
    expect(validateSessionOrWindowName('日本語')).toBe('英数字・_・- のみ使用できます');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateSessionOrWindowName('  ok  ')).toBeNull();
  });
});
