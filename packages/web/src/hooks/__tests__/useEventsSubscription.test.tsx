import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventsSubscription } from '../useEventsSubscription';
import { useEventsStore } from '@/stores/events';
import { useSessionsStore } from '@/stores/sessions';
import { useAuthStore } from '@/stores/auth';

const startMock = vi.fn();
const stopMock = vi.fn();
let lastOptions: { onEvent: (e: unknown) => void; onStatusChange: (s: string, a: number) => void } | null = null;

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function (this: unknown, options: typeof lastOptions) {
    lastOptions = options;
    return { start: startMock, stop: stopMock, triggerReconnect: vi.fn() };
  }),
}));

describe('useEventsSubscription', () => {
  beforeEach(() => {
    startMock.mockReset();
    stopMock.mockReset();
    lastOptions = null;
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
    useSessionsStore.setState({ sessions: [], loading: false, error: null });
    useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts client on mount and stops on unmount', () => {
    const { unmount } = renderHook(() => useEventsSubscription());
    expect(startMock).toHaveBeenCalledOnce();
    unmount();
    expect(stopMock).toHaveBeenCalledOnce();
  });

  it('does not start when token is missing', () => {
    useAuthStore.setState({ token: null, gatewayUrl: null });
    renderHook(() => useEventsSubscription());
    expect(startMock).not.toHaveBeenCalled();
  });

  it('updates events store on status change', () => {
    renderHook(() => useEventsSubscription());
    act(() => lastOptions!.onStatusChange('connected', 0));
    expect(useEventsStore.getState().status).toBe('connected');
  });

  it('triggers debounced refetch on sessions-changed event', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    useSessionsStore.setState({
      sessions: [],
      loading: false,
      error: null,
      refetch,
    } as Partial<ReturnType<typeof useSessionsStore.getState>> as ReturnType<typeof useSessionsStore.getState>);
    renderHook(() => useEventsSubscription());
    act(() => lastOptions!.onEvent({ type: 'sessions-changed' }));
    act(() => lastOptions!.onEvent({ type: 'sessions-changed' }));
    expect(refetch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
