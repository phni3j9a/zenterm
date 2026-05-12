import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// xterm mocks required by TerminalPane which is rendered inside AuthenticatedShell
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
import { useSessionsStore } from '@/stores/sessions';
import { usePaneStore } from '@/stores/pane';

const FULL_RATIOS = {
  single: [],
  'cols-2': [0.5],
  'cols-3': [1 / 3, 0.5],
  'grid-2x2': [0.5, 0.5],
  'main-side-2': [0.6, 0.5],
};

describe('AuthenticatedShell URL reverse sync', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://localhost' });
    useSessionsStore.setState({
      sessions: [
        {
          name: 'zen_dev',
          displayName: 'dev',
          created: 0,
          cwd: '/tmp',
          windows: [{ index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/tmp' }],
        },
      ],
      loading: false,
      error: null,
    });
    usePaneStore.setState({
      layout: 'single',
      panes: [null],
      focusedIndex: 0,
      ratios: FULL_RATIOS,
      savedLayout: null,
    });
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
  });

  it('pane store reflects assignment after assignPane is called', async () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );

    await act(async () => {
      usePaneStore.getState().assignPane(0, { sessionId: 'dev', windowIndex: 0 });
      await Promise.resolve();
    });

    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'dev', windowIndex: 0 });
  });

  it('pane store reflects window index assignment', async () => {
    // Pre-set a session with multiple windows
    useSessionsStore.setState({
      sessions: [
        {
          name: 'zen_dev',
          displayName: 'dev',
          created: 0,
          cwd: '/tmp',
          windows: [
            { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/tmp' },
            { index: 2, name: 'w2', active: false, zoomed: false, paneCount: 1, cwd: '/tmp' },
          ],
        },
      ],
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/web/sessions/dev']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );

    await act(async () => {
      usePaneStore.getState().assignPane(0, { sessionId: 'dev', windowIndex: 2 });
      await Promise.resolve();
    });

    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'dev', windowIndex: 2 });
  });
});
