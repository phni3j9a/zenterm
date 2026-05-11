import { describe, expect, it } from 'vitest';
import { formatFileDate, formatFileSize } from '../filesFormat';

describe('formatFileSize', () => {
  it('B', () => expect(formatFileSize(512)).toBe('512 B'));
  it('KB', () => expect(formatFileSize(2048)).toBe('2.0 KB'));
  it('MB', () => expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB'));
  it('GB', () => expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3.0 GB'));
});

describe('formatFileDate', () => {
  it('formats epoch seconds via Date.toLocaleString with given locale', () => {
    // 2024-01-02 00:00:00 UTC = 1704153600 (sec)
    const out = formatFileDate(1704153600, 'en-US');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
  it('formats epoch milliseconds when value > 1e12', () => {
    const out = formatFileDate(1704153600000, 'en-US');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
