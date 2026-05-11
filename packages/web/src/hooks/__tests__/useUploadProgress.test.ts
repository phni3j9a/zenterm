import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUploadProgress } from '../useUploadProgress';

describe('useUploadProgress', () => {
  it('starts inactive with zero totals', () => {
    const { result } = renderHook(() => useUploadProgress());
    expect(result.current.active).toBe(false);
    expect(result.current.total).toBe(0);
    expect(result.current.completed).toBe(0);
    expect(result.current.currentFile).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('begin() sets active=true with total and resets progress', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => {
      result.current.begin(3);
    });
    expect(result.current.active).toBe(true);
    expect(result.current.total).toBe(3);
    expect(result.current.completed).toBe(0);
    expect(result.current.currentFile).toBeUndefined();
  });

  it('markStart() sets currentFile; markDone() increments completed', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => {
      result.current.begin(2);
    });
    act(() => {
      result.current.markStart('file1.txt');
    });
    expect(result.current.currentFile).toBe('file1.txt');
    act(() => {
      result.current.markDone();
    });
    expect(result.current.completed).toBe(1);
    act(() => {
      result.current.markStart('file2.txt');
    });
    act(() => {
      result.current.markDone();
    });
    expect(result.current.completed).toBe(2);
  });

  it('fail() sets error message', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => {
      result.current.begin(1);
      result.current.markStart('bad.txt');
      result.current.fail('network error');
    });
    expect(result.current.error).toBe('network error');
    expect(result.current.active).toBe(true);
  });

  it('finish() resets to initial state', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => {
      result.current.begin(2);
      result.current.markStart('a.txt');
      result.current.markDone();
      result.current.finish();
    });
    expect(result.current.active).toBe(false);
    expect(result.current.total).toBe(0);
    expect(result.current.completed).toBe(0);
    expect(result.current.currentFile).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });
});
