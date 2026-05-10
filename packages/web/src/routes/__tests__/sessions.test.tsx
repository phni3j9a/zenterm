import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// xterm mocks (TerminalPane mounts XtermView once a session is selected)
// Use function() form for vitest 4.x compatibility (arrow form fails)
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function() {
    return {
      open: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      write: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      options: {},
      cols: 80,
      rows: 24,
      unicode: { activeVersion: '6' },
    };
  }),
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function() {
    return { fit: vi.fn() };
  }),
}));
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(function() {
    return {};
  }),
}));
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(function() {
    return {};
  }),
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { SessionsRoute } from '../sessions';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close() { this.readyState = MockWebSocket.CLOSED; }
  constructor(url: string) { this.url = url; }
}

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: '1234', gatewayUrl: 'http://gateway.test:18765' });
  useSessionsStore.setState({ sessions: [], loading: false, error: null });
  useSessionViewStore.setState({ activeSessionId: null, activeWindowIndex: null });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionsRoute', () => {
  it('loads sessions on mount and renders Sidebar entries', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: 'zen_dev', displayName: 'dev', created: 1, cwd: '/h', windows: [] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    render(
      <MemoryRouter>
        <SessionsRoute />
      </MemoryRouter>,
    );
    expect(await screen.findByText('dev')).toBeInTheDocument();
    expect(screen.getByText(/Select a session/i)).toBeInTheDocument();
  });

  it('clicking a session opens TerminalPane with session/window in header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: 'zen_dev', displayName: 'dev', created: 1, cwd: '/h', windows: [] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    render(
      <MemoryRouter>
        <SessionsRoute />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText('dev'));
    // Toolbar shows the session name
    expect(screen.getAllByText(/dev/).length).toBeGreaterThan(1);
  });

  it('on 401 from listSessions, logs out and redirects to /web/login', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <SessionsRoute />
      </MemoryRouter>,
    );
    // Wait for state to settle: useAuthStore should be cleared
    await vi.waitFor(() => {
      expect(useAuthStore.getState().token).toBeNull();
    });
  });
});
