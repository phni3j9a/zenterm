import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuthorizedBlobUrl } from '../useAuthorizedBlobUrl';

describe('useAuthorizedBlobUrl', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('starts as { url: null, loading: true, error: null } when url is given', async () => {
    fetchSpy.mockResolvedValue(new Response(new Blob(['x'])));
    const { result } = renderHook(() => useAuthorizedBlobUrl('http://gw/api/files/raw?path=a', 'tok'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.url).toBe('blob:mock-url');
    expect(result.current.error).toBeNull();
  });

  it('passes Bearer token in Authorization header', async () => {
    fetchSpy.mockResolvedValue(new Response(new Blob(['x'])));
    renderHook(() => useAuthorizedBlobUrl('http://gw/x', 'mytok'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer mytok');
  });

  it('sets error on non-OK response', async () => {
    fetchSpy.mockResolvedValue(new Response('boom', { status: 500 }));
    const { result } = renderHook(() => useAuthorizedBlobUrl('http://gw/x', 'tok'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.url).toBeNull();
  });

  it('does nothing when url is null', () => {
    const { result } = renderHook(() => useAuthorizedBlobUrl(null, 'tok'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('revokes object URL on unmount', async () => {
    fetchSpy.mockResolvedValue(new Response(new Blob(['x'])));
    const { result, unmount } = renderHook(() => useAuthorizedBlobUrl('http://gw/x', 'tok'));
    await waitFor(() => expect(result.current.url).toBe('blob:mock-url'));
    act(() => {
      unmount();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
