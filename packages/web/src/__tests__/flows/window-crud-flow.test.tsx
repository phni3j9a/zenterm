import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useEventsStore } from '@/stores/events';
import { useSessionViewStore } from '@/stores/sessionView';

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function () {
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

beforeEach(() => {
  // jsdom polyfills (mirror Task 24's setup)
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
  // matchMedia polyfill (TerminalPane uses it)
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
  // ResizeObserver stub
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  // WebSocket stub
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
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
  useSessionsStore.setState({
    sessions: [
      {
        name: 'zen_a',
        displayName: 'a',
        created: 1,
        cwd: '/',
        windows: [
          { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
          { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
        ],
      },
    ],
    loading: false,
    error: null,
  });
  useSessionViewStore.setState({ activeSessionId: 'a', activeWindowIndex: 0 });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
    return handler(typeof input === 'string' ? input : input.url, init);
  }));
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/web/sessions']}>
      <App />
    </MemoryRouter>,
  );
}

describe('Window CRUD flows', () => {
  it('creates a window via "+ window" inside expanded session', async () => {
    let createdWindow = false;
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/sessions') && method === 'GET') {
        const windows = createdWindow
          ? [
              { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
              { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
              { index: 2, name: 'logs', active: false, zoomed: false, paneCount: 1, cwd: '/' },
            ]
          : [
              { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
              { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
            ];
        return new Response(
          JSON.stringify([{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions/a/windows') && method === 'POST') {
        createdWindow = true;
        return new Response(
          JSON.stringify({ index: 2, name: 'logs', active: false, zoomed: false, paneCount: 1, cwd: '/' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    await userEvent.click(screen.getByRole('button', { name: /\+ New window/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /New window/i }), 'logs{Enter}');

    await waitFor(() =>
      expect(
        useSessionsStore.getState().sessions[0].windows?.map((w) => w.name),
      ).toContain('logs'),
    );
  });

  it('renames a window via kebab → Rename', async () => {
    let renamed = false;
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/sessions') && method === 'GET') {
        const windows = renamed
          ? [
              { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
              { index: 1, name: 'renamed', active: false, zoomed: false, paneCount: 1, cwd: '/' },
            ]
          : [
              { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
              { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
            ];
        return new Response(
          JSON.stringify([{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions/a/windows/1') && method === 'PATCH') {
        renamed = true;
        return new Response(
          JSON.stringify({ index: 1, name: 'renamed', active: false, zoomed: false, paneCount: 1, cwd: '/' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    await userEvent.click(screen.getByLabelText(/Actions for window w1/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox', { name: /Rename/i });
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');

    await waitFor(() =>
      expect(
        useSessionsStore.getState().sessions[0].windows?.find((w) => w.index === 1)?.name,
      ).toBe('renamed'),
    );
  });

  it('deletes a window through ConfirmDialog → fallback to next', async () => {
    let deleted = false;
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/sessions') && method === 'GET') {
        const windows = deleted
          ? [{ index: 1, name: 'w1', active: true, zoomed: false, paneCount: 1, cwd: '/' }]
          : [
              { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
              { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
            ];
        return new Response(
          JSON.stringify([{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions/a/windows/0') && method === 'DELETE') {
        deleted = true;
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    await userEvent.click(screen.getByLabelText(/Actions for window w0/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(screen.getByText(/Delete window/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() =>
      expect(useSessionViewStore.getState().activeWindowIndex).toBe(1),
    );
  });
});
