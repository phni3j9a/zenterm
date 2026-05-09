import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { createImeDedup } from '../imeDedup';

describe('createImeDedup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes single-character input always', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('a', 0)).toBe(true);
    expect(dedup.shouldPass('a', 50)).toBe(true);
  });

  it('passes control characters always', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('\x1b', 0)).toBe(true);
    expect(dedup.shouldPass('\x1b', 50)).toBe(true);
  });

  it('drops duplicate multi-char input within 100ms', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('hello', 0)).toBe(true);
    expect(dedup.shouldPass('hello', 50)).toBe(false);
    expect(dedup.shouldPass('hello', 99)).toBe(false);
  });

  it('passes duplicate multi-char input after 100ms', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('hello', 0)).toBe(true);
    expect(dedup.shouldPass('hello', 100)).toBe(true);
    expect(dedup.shouldPass('hello', 200)).toBe(true);
  });

  it('different input within 100ms passes', () => {
    const dedup = createImeDedup();
    expect(dedup.shouldPass('hello', 0)).toBe(true);
    expect(dedup.shouldPass('world', 50)).toBe(true);
  });
});
