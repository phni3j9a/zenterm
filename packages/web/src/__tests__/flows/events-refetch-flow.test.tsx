import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useEventsStore } from '@/stores/events';

let lastClientOptions: { onEvent: (e: unknown) => void; onStatusChange: (s: string, a: number) => void } | null = null;

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function (options: typeof lastClientOptions) {
    lastClientOptions = options;
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

beforeEach(() => {
  // jsdom polyfills (mirror Task 24/25 setup)
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('WebSocket', class {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onclose: ((ev: { code: number }) => void) | null = null;
    onerror: (() => void) | null = null;
    close() {
      this.readyState = 3;
    }
  });
  lastClientOptions = null;
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
  useSessionsStore.setState({ sessions: [], loading: false, error: null });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('events → refetch flow', () => {
  it('refetches sessions after sessions-changed event (debounced)', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount += 1;
      const sessions =
        callCount === 1
          ? []
          : [{ name: 'zen_x', displayName: 'x', created: 1, cwd: '/', windows: [] }];
      return new Response(JSON.stringify(sessions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(lastClientOptions).not.toBeNull());

    act(() => {
      lastClientOptions!.onStatusChange('connected', 0);
    });
    expect(useEventsStore.getState().status).toBe('connected');

    // Enable fake timers only for the debounce window, then restore real timers
    vi.useFakeTimers();

    act(() => {
      lastClientOptions!.onEvent({ type: 'sessions-changed' });
      lastClientOptions!.onEvent({ type: 'sessions-changed' });
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    // Switch to real timers so waitFor's internal polling works
    vi.useRealTimers();

    await waitFor(() =>
      expect(useSessionsStore.getState().sessions.map((s) => s.displayName)).toEqual(['x']),
    );
  });

  it('updates events status indicator on reconnecting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(lastClientOptions).not.toBeNull());
    act(() => {
      lastClientOptions!.onStatusChange('reconnecting', 3);
    });
    expect(screen.getByLabelText(/Realtime updates: reconnecting \(attempt 3\)/i)).toBeInTheDocument();
  });
});
