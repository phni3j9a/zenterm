import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FilesRoute } from '../files';
import { useAuthStore } from '@/stores/auth';
import { useFilesStore } from '@/stores/files';

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

describe('FilesRoute deep link', () => {
  beforeEach(() => {
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
    useAuthStore.setState({ token: '4812', gatewayUrl: 'http://localhost' });
    useFilesStore.setState({ currentPath: '~' } as any);
  });

  it('sets currentPath to URL-decoded :path* on mount', async () => {
    render(
      <MemoryRouter initialEntries={['/web/files/home/server/projects']}>
        <Routes>
          <Route path="/web/files/*" element={<FilesRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(useFilesStore.getState().currentPath).toBe('/home/server/projects');
    });
  });

  it('preserves "~" prefix for home-relative deep links', async () => {
    render(
      <MemoryRouter initialEntries={['/web/files/~/src']}>
        <Routes>
          <Route path="/web/files/*" element={<FilesRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(useFilesStore.getState().currentPath).toBe('~/src');
    });
  });

  it('rejects malformed pct-encoding and keeps default cwd', async () => {
    render(
      <MemoryRouter initialEntries={['/web/files/%2/bad']}>
        <Routes>
          <Route path="/web/files/*" element={<FilesRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(useFilesStore.getState().currentPath).toBe('~');
    });
  });
});
