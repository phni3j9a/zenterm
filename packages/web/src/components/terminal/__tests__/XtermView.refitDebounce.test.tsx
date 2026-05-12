import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createTrailingDebounce } from '../refitDebounce';

describe('createTrailingDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires immediately on first call', () => {
    const fn = vi.fn();
    const debounced = createTrailingDebounce(fn, 50);
    debounced();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid calls within window into one trailing fire', () => {
    const fn = vi.fn();
    const debounced = createTrailingDebounce(fn, 50);
    debounced(); // immediate
    debounced(); // pending
    debounced(); // still pending
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(51);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('fires again immediately if next call comes after window', () => {
    const fn = vi.fn();
    const debounced = createTrailingDebounce(fn, 50);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel clears pending fire', () => {
    const fn = vi.fn();
    const debounced = createTrailingDebounce(fn, 50);
    debounced();
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
