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
import { useUiStore } from '@/stores/ui';
import { useLayoutStore } from '@/stores/layout';

function setup() {
  useAuthStore.setState({ token: 't', gatewayUrl: 'http://x' } as never);
  useSessionsStore.setState({
    sessions: [
      { name: 'zen_sX', displayName: 'sX', windows: [
        { index: 0, name: 'w0' },
        { index: 1, name: 'w1' },
        { index: 2, name: 'w2' },
      ] },
    ],
    loading: false,
    error: null,
  } as never);
  usePaneStore.setState({
    layout: 'single',
    panes: [{ sessionId: 'sX', windowIndex: 0 }, null, null, null],
    focusedIndex: 0,
    ratios: { single: [], 'cols-2': [0.5], 'cols-3': [0.5, 0.5], 'grid-2x2': [0.5], 'main-side-2': [0.6, 0.5] },
    savedLayout: null,
  } as never);
  useLayoutStore.setState({ sidebarCollapsed: false, paletteOpen: false, layoutMenuOpen: false });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
}

function dispatch(ev: Partial<KeyboardEvent>) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...ev }));
}

describe('AuthenticatedShell shortcuts', () => {
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
    setup();
  });

  it('⌘2 sets focused pane window to index 1', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: '2', metaKey: true }));
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'sX', windowIndex: 1 });
  });

  it('⌘5 is no-op when target window does not exist', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: '5', metaKey: true }));
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'sX', windowIndex: 0 });
  });

  it('⌘W shows a confirm dialog (does not delete unconfirmed)', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: 'w', metaKey: true }));
    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    expect(useUiStore.getState().confirmDialog?.destructive).toBe(true);
  });

  it('⌘T is a no-op when no pane is focused with a session', () => {
    usePaneStore.setState({
      ...usePaneStore.getState(),
      panes: [null, null, null, null],
    } as never);
    const spy = vi.spyOn(useSessionsStore.getState(), 'createWindow').mockResolvedValue();
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: 't', metaKey: true }));
    expect(spy).not.toHaveBeenCalled();
  });
});
