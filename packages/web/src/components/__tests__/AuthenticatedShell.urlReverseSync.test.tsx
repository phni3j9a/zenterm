import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

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

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: class { start() {} stop() {} },
}));

vi.mock('@/api/client', () => ({
  ApiClient: class {
    async listSessions() {
      return [{
        name: 'dev', displayName: 'dev', created: 0,
        windows: [
          { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/tmp' },
          { index: 2, name: 'w2', active: false, zoomed: false, paneCount: 1, cwd: '/tmp' },
        ],
        cwd: '/tmp',
      }];
    }
    async createSession() { return {}; }
    async renameSession() { return {}; }
    async killSession() { return { ok: true }; }
    async createWindow() { return {}; }
    async renameWindow() { return {}; }
    async killWindow() { return { ok: true }; }
    async listFiles() { return { path: '/', entries: [] }; }
    async getFileContent() { return { path: '', content: '', lines: 0, truncated: false }; }
    async writeFileContent() { return { path: '', bytes: 0 }; }
    async deleteFile() { return { path: '', deleted: true }; }
    async renameFile() { return { oldPath: '', newPath: '' }; }
    async copyFiles() { return { copied: [] }; }
    async moveFiles() { return { moved: [] }; }
    async createDirectory() { return { path: '', created: true }; }
    async uploadFile() { return { success: true, path: '', filename: '', size: 0, mimetype: '' }; }
    buildRawFileUrl() { return ''; }
  },
}));

import { AuthenticatedShell } from '../AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { usePaneStore } from '@/stores/pane';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="pathname">{loc.pathname}</div>;
}

describe('AuthenticatedShell URL reverse sync', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: '4812', gatewayUrl: 'http://localhost' });
    useSessionsStore.setState({
      sessions: [{
        sessionId: 'dev', displayName: 'dev', name: 'dev',
        windows: [
          { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/tmp' },
          { index: 2, name: 'w2', active: false, zoomed: false, paneCount: 1, cwd: '/tmp' },
        ],
        cwd: '/tmp', created: 0,
      } as any],
      loading: false,
      error: null,
    } as any);
    usePaneStore.setState({
      layout: 'single',
      panes: [null],
      focusedIndex: 0,
      savedLayout: null,
    } as any);
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

  it('pushes URL to /web/sessions/:id when focused pane is assigned (window 0)', async () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
        <LocationProbe />
      </MemoryRouter>,
    );
    await act(async () => {
      usePaneStore.getState().assignPane(0, { sessionId: 'dev', windowIndex: 0 });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId('pathname').textContent).toBe('/web/sessions/dev');
  });

  it('pushes URL to /web/sessions/:id/window/:idx when windowIndex > 0', async () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
        <LocationProbe />
      </MemoryRouter>,
    );
    await act(async () => {
      usePaneStore.getState().assignPane(0, { sessionId: 'dev', windowIndex: 2 });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId('pathname').textContent).toBe('/web/sessions/dev/window/2');
  });

  it('does not push URL when not on /web/sessions route', async () => {
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <AuthenticatedShell />
        <LocationProbe />
      </MemoryRouter>,
    );
    await act(async () => {
      usePaneStore.getState().assignPane(0, { sessionId: 'dev', windowIndex: 0 });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByTestId('pathname').textContent).toBe('/web/files');
  });
});
