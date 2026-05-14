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

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: class { start() {} stop() {} },
}));

vi.mock('@/api/client', () => ({
  ApiClient: class {
    async listSessions() { return []; }
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

describe('AuthenticatedShell URL hash → paneStore sync', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: '4812', gatewayUrl: 'http://localhost' });
    useSessionsStore.setState({
      sessions: [
        { sessionId: 'a', displayName: 'a', name: 'a', windows: [{ index: 0, name: 'w', active: true }], cwd: '/tmp', attachedClients: 0 } as any,
        { sessionId: 'b', displayName: 'b', name: 'b', windows: [{ index: 0, name: 'w', active: true }], cwd: '/tmp', attachedClients: 0 } as any,
      ],
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

  it('applies hash on mount to paneStore (cols-2 layout + 2 panes)', async () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions#l=cols-2&p=a.0,b.0']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    const s = usePaneStore.getState();
    expect(s.layout).toBe('cols-2');
    expect(s.panes).toEqual([
      { kind: 'terminal', sessionId: 'a', windowIndex: 0 },
      { kind: 'terminal', sessionId: 'b', windowIndex: 0 },
    ]);
  });

  it('ignores malformed hash and leaves store unchanged', async () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions#l=garbage']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(usePaneStore.getState().layout).toBe('single');
  });
});
