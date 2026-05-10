import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useEventsStore } from '@/stores/events';

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function () {
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

beforeEach(() => {
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
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('WebSocket', class {
    static OPEN = 1;
    static CLOSED = 3;
    url: string;
    readyState = 0;
    onopen: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    send = vi.fn();
    close() { this.readyState = 3; }
    constructor(url: string) { this.url = url; }
  });
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
  useSessionsStore.setState({ sessions: [], loading: false, error: null });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
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

describe('Session CRUD flows', () => {
  it('creates a session via "+ 新規セッション"', async () => {
    const created = { name: 'zen_x', displayName: 'x', created: 1, cwd: '/', windows: [] };
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/api/sessions') && init?.method === 'POST') {
        return new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByRole('button', { name: /新規セッション/ }));
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /新規セッション名/ }), 'x{Enter}');

    await waitFor(() => expect(useSessionsStore.getState().sessions).toHaveLength(1));
    expect(useSessionsStore.getState().sessions[0].displayName).toBe('x');
  });

  it('renames a session via kebab → Rename', async () => {
    useSessionsStore.setState({
      sessions: [{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }],
      loading: false,
      error: null,
    });
    const renamed = { name: 'zen_renamed', displayName: 'renamed', created: 1, cwd: '/', windows: [] };
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify([{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/sessions/a') && init?.method === 'PATCH') {
        return new Response(JSON.stringify(renamed), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox', { name: /セッション名を編集/ });
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');

    await waitFor(() =>
      expect(useSessionsStore.getState().sessions[0].displayName).toBe('renamed'),
    );
  });

  it('rename surfacing 409 shows toast (and store unchanged)', async () => {
    useSessionsStore.setState({
      sessions: [{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }],
      loading: false,
      error: null,
    });
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify([{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/sessions/a') && init?.method === 'PATCH') {
        return new Response('conflict', { status: 409 });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox', { name: /セッション名を編集/ });
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');

    await waitFor(() => expect(useUiStore.getState().toasts.length).toBeGreaterThan(0));
    expect(useSessionsStore.getState().sessions[0].displayName).toBe('a');
  });

  it('deletes a session through ConfirmDialog → API', async () => {
    useSessionsStore.setState({
      sessions: [
        { name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] },
        { name: 'zen_b', displayName: 'b', created: 2, cwd: '/', windows: [] },
      ],
      loading: false,
      error: null,
    });
    let deleted = false;
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        const list = deleted
          ? [{ name: 'zen_b', displayName: 'b', created: 2, cwd: '/', windows: [] }]
          : [
              { name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] },
              { name: 'zen_b', displayName: 'b', created: 2, cwd: '/', windows: [] },
            ];
        return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/api/sessions/a') && init?.method === 'DELETE') {
        deleted = true;
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(screen.getByText(/a を削除しますか/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() =>
      expect(useSessionsStore.getState().sessions.map((s) => s.displayName)).toEqual(['b']),
    );
  });
});
