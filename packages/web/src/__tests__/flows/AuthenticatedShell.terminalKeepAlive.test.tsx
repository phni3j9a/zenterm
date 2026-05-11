import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// Mock xterm so the component tree mounts cleanly.
const constructorCalls: number[] = [];
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function () {
    constructorCalls.push(performance.now());
    return {
      open: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
      attachCustomKeyEventHandler: vi.fn(),
      write: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      getSelection: vi.fn(() => ''),
      clear: vi.fn(),
      refresh: vi.fn(),
      options: {},
      cols: 80,
      rows: 24,
      unicode: { activeVersion: '6' },
    };
  }),
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function () { return { fit: vi.fn() }; }),
}));
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(function () { return {}; }),
}));
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(function () { return {}; }),
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close(code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 } as CloseEvent);
  }
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

import { AuthenticatedShell } from '@/components/AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';
import { useSessionViewStore } from '@/stores/sessionView';

beforeEach(() => {
  constructorCalls.length = 0;
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const isFiles = url.includes('/api/files');
    const body = isFiles ? { entries: [], path: '~' } : [];
    return Promise.resolve({
      ok: true, status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }));
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example.com:18765' });
  useSessionViewStore.setState({ activeSessionId: 'dev', activeWindowIndex: 0 });
});

describe('AuthenticatedShell terminal keep-alive', () => {
  it('does not construct a new Terminal when navigating to /web/files and back', async () => {
    let nav: ((to: string) => void) | null = null;
    function Capture() {
      const n = useNavigate();
      useEffect(() => { nav = n; }, [n]);
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Routes>
          <Route
            path="/web/*"
            element={
              <>
                <Capture />
                <AuthenticatedShell />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const initial = constructorCalls.length;
    expect(initial).toBeGreaterThan(0);
    const wsBefore = MockWebSocket.instances.length;

    await act(async () => { nav?.('/web/files'); });
    await act(async () => { nav?.('/web/sessions'); });

    expect(constructorCalls.length).toBe(initial);
    expect(MockWebSocket.instances.length).toBe(wsBefore);
  });
});
