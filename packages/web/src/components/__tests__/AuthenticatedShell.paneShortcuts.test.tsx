import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function () {
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

import { AuthenticatedShell } from '../AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';
import { usePaneStore } from '@/stores/pane';
import { useSessionsStore } from '@/stores/sessions';
import { useLayoutStore } from '@/stores/layout';

function dispatch(ev: Partial<KeyboardEvent>) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...ev }));
}

describe('Pane focus shortcuts', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('WebSocket', class {
      static OPEN = 1;
      readyState = 0;
      send = vi.fn();
      close = vi.fn();
      onopen: ((ev: Event) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onclose: ((ev: CloseEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      constructor(public url: string) {}
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => [],
      text: async () => '[]',
    }));
    useAuthStore.setState({ token: 't', gatewayUrl: 'http://x' } as never);
    useSessionsStore.setState({ sessions: [], loading: false, error: null } as never);
    useLayoutStore.setState({ sidebarCollapsed: false, paletteOpen: false, layoutMenuOpen: false });
    usePaneStore.setState({
      layout: 'cols-2',
      panes: [
        { sessionId: 'a', windowIndex: 0 },
        { sessionId: 'b', windowIndex: 0 },
        null, null,
      ],
      focusedIndex: 0,
      savedLayout: null,
    } as never);
  });

  it('⌘] advances focus through occupied slots only', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: ']', metaKey: true }));
    expect(usePaneStore.getState().focusedIndex).toBe(1);
    act(() => dispatch({ key: ']', metaKey: true }));
    expect(usePaneStore.getState().focusedIndex).toBe(0);
  });

  it('⌘[ moves focus backward', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: '[', metaKey: true }));
    expect(usePaneStore.getState().focusedIndex).toBe(1);
  });

  it('⌘\\ opens the layout menu', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(false);
    act(() => dispatch({ key: '\\', metaKey: true }));
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(true);
  });
});
