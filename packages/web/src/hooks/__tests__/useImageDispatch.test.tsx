import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useImageDispatch, type ImageDispatchDeps } from '../useImageDispatch';
import type { ApiClient } from '@/api/client';
import type { UploadProgressApi } from '../useUploadProgress';

function makeProgress(active = false): UploadProgressApi {
  return {
    active,
    total: 0,
    completed: 0,
    currentFile: undefined,
    error: undefined,
    begin: vi.fn(),
    markStart: vi.fn(),
    markDone: vi.fn(),
    fail: vi.fn(),
    finish: vi.fn(),
  };
}

function makeDeps(over: Partial<ImageDispatchDeps> = {}): ImageDispatchDeps {
  const apiClient = { uploadFile: vi.fn() } as unknown as ApiClient;
  return {
    apiClient,
    write: vi.fn().mockReturnValue(true),
    uploadProgress: makeProgress(),
    pushToast: vi.fn(),
    t: ((key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key) as ImageDispatchDeps['t'],
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useImageDispatch', () => {
  it('does nothing when files array is empty', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useImageDispatch(deps));
    await act(async () => {
      await result.current.dispatch([]);
    });
    expect(deps.uploadProgress.begin).not.toHaveBeenCalled();
    expect(deps.apiClient!.uploadFile).not.toHaveBeenCalled();
    expect(deps.write).not.toHaveBeenCalled();
  });

  it('shows uploadBusy toast and early-returns when uploadProgress.active', async () => {
    const deps = makeDeps({ uploadProgress: makeProgress(true) });
    const { result } = renderHook(() => useImageDispatch(deps));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([file]);
    });
    expect(deps.pushToast).toHaveBeenCalledWith({ type: 'error', message: 'terminal.uploadBusy' });
    expect(deps.apiClient!.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads a single file and writes the quoted path with trailing space', async () => {
    const deps = makeDeps();
    (deps.apiClient!.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      path: '/home/u/uploads/zenterm/2026-05-14_120000_abcd.png',
      filename: '2026-05-14_120000_abcd.png',
      size: 1,
      mimetype: 'image/png',
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([file]);
    });
    expect(deps.uploadProgress.begin).toHaveBeenCalledWith(1);
    expect(deps.uploadProgress.markStart).toHaveBeenCalledWith('a.png');
    expect(deps.uploadProgress.markDone).toHaveBeenCalledTimes(1);
    expect(deps.write).toHaveBeenCalledWith(
      "'/home/u/uploads/zenterm/2026-05-14_120000_abcd.png' ",
    );
    expect(deps.pushToast).toHaveBeenCalledWith({
      type: 'success',
      message: expect.stringContaining('terminal.uploadDone'),
    });
  });

  it('uploads multiple files sequentially in order, writing each path with a space', async () => {
    const deps = makeDeps();
    const calls: string[] = [];
    (deps.apiClient!.uploadFile as ReturnType<typeof vi.fn>).mockImplementation(
      async (f: File) => {
        calls.push(`upload:${f.name}`);
        return {
          success: true,
          path: `/staging/${f.name}`,
          filename: f.name,
          size: 1,
          mimetype: 'image/png',
        };
      },
    );
    (deps.write as ReturnType<typeof vi.fn>).mockImplementation((text: string) => {
      calls.push(`write:${text}`);
      return true;
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const f1 = new File(['x'], 'a.png', { type: 'image/png' });
    const f2 = new File(['y'], 'b.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([f1, f2]);
    });
    expect(calls).toEqual([
      'upload:a.png',
      "write:'/staging/a.png' ",
      'upload:b.png',
      "write:'/staging/b.png' ",
    ]);
  });

  it('on upload failure, calls fail+pushToast and aborts remaining files', async () => {
    const deps = makeDeps();
    (deps.apiClient!.uploadFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        success: true,
        path: '/staging/ok.png',
        filename: 'ok.png',
        size: 1,
        mimetype: 'image/png',
      })
      .mockRejectedValueOnce(new Error('413 too large'));
    const { result } = renderHook(() => useImageDispatch(deps));
    const f1 = new File(['x'], 'ok.png', { type: 'image/png' });
    const f2 = new File(['y'], 'bad.png', { type: 'image/png' });
    const f3 = new File(['z'], 'never.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([f1, f2, f3]);
    });
    expect(deps.apiClient!.uploadFile).toHaveBeenCalledTimes(2);
    expect(deps.write).toHaveBeenCalledTimes(1);
    expect(deps.uploadProgress.fail).toHaveBeenCalledWith('413 too large');
    expect(deps.pushToast).toHaveBeenCalledWith({
      type: 'error',
      message: expect.stringContaining('terminal.uploadError'),
    });
  });

  it('on write returning false (WebSocket closed), shows notConnected toast and aborts remaining files', async () => {
    const deps = makeDeps({ write: vi.fn().mockReturnValue(false) });
    (deps.apiClient!.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      path: '/staging/a.png',
      filename: 'a.png',
      size: 1,
      mimetype: 'image/png',
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const f1 = new File(['x'], 'a.png', { type: 'image/png' });
    const f2 = new File(['y'], 'b.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([f1, f2]);
    });
    expect(deps.apiClient!.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.pushToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'terminal.notConnected',
    });
  });

  it('calls finish() after success with 1500ms delay', async () => {
    const deps = makeDeps();
    (deps.apiClient!.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      path: '/staging/a.png',
      filename: 'a.png',
      size: 1,
      mimetype: 'image/png',
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([file]);
    });
    expect(deps.uploadProgress.finish).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    // Restore real timers before waitFor so its internal setInterval polling works
    // (vi.useFakeTimers causes waitFor to deadlock in jsdom/vitest environments).
    vi.useRealTimers();
    await waitFor(() => expect(deps.uploadProgress.finish).toHaveBeenCalled());
  });
});
