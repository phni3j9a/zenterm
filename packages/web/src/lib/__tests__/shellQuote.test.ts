import { describe, expect, it } from 'vitest';
import { shellQuote } from '../shellQuote';

describe('shellQuote', () => {
  it('wraps an empty string in two single quotes', () => {
    expect(shellQuote('')).toBe("''");
  });

  it('wraps a plain alphanumeric string in single quotes', () => {
    expect(shellQuote('foo')).toBe("'foo'");
  });

  it('keeps spaces inside the quotes', () => {
    expect(shellQuote('foo bar')).toBe("'foo bar'");
  });

  it('escapes single quotes by closing+escaping+reopening', () => {
    // foo'bar -> 'foo'\''bar'
    expect(shellQuote("foo'bar")).toBe("'foo'\\''bar'");
  });

  it('handles a string that is only a single quote', () => {
    // ' -> ''\'''
    expect(shellQuote("'")).toBe("''\\'''");
  });

  it('handles consecutive single quotes', () => {
    // '' -> ''\'''\'''
    expect(shellQuote("''")).toBe("''\\'''\\'''");
  });

  it('passes UTF-8 characters through untouched', () => {
    expect(shellQuote('日本語ファイル.png')).toBe("'日本語ファイル.png'");
  });

  it('does not strip absolute paths', () => {
    expect(shellQuote('/home/user/uploads/zenterm/2026-05-14_120000_abcd.png'))
      .toBe("'/home/user/uploads/zenterm/2026-05-14_120000_abcd.png'");
  });
});
