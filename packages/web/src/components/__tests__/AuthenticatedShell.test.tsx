import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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
import { useFilesStore } from '@/stores/files';
import { useSessionViewStore } from '@/stores/sessionView';

describe('AuthenticatedShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    useSessionViewStore.setState({ activeSessionId: null, activeWindowIndex: null });
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

  it('redirects to /web/login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    // Sidebar / Settings should NOT render when redirected
    expect(document.body.textContent).not.toMatch(/Sessions|Settings/);
  });

  it('renders Sidebar + TerminalPane when authenticated', () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    expect(screen.getAllByLabelText(/Sessions/i).length).toBeGreaterThan(0);
  });

  it('keeps TerminalPane mounted (hidden) when navigated to /web/files', async () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    useFilesStore.getState().reset();
    useSessionViewStore.setState({ activeSessionId: 'dev', activeWindowIndex: 0 });
    // FilesSidebarPanel + FilesList expect a FileListResponse shape on /web/files.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ entries: [], path: '~' }),
      text: async () => '{"entries":[],"path":"~"}',
    }));
    const { container } = render(
      <MemoryRouter initialEntries={['/web/files']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    // Flush pending fetch promises so FilesSidebarPanel resolves without act() warnings.
    await act(async () => {
      await Promise.resolve();
    });
    // TerminalPane real (non-empty-state) root must exist with display:none.
    const terminalRoot = container.querySelector('section[data-terminal-root="true"]');
    expect(terminalRoot).not.toBeNull();
    expect((terminalRoot as HTMLElement).style.display).toBe('none');
  });

  it('suspends current layout to single when route leaves /web/sessions', async () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    const { usePaneStore } = await import('@/stores/pane');
    usePaneStore.setState({
      layout: 'cols-2',
      panes: [{ sessionId: 'a', windowIndex: 0 }, { sessionId: 'b', windowIndex: 0 }],
      focusedIndex: 0,
      ratios: {
        single: [],
        'cols-2': [0.5],
        'cols-3': [1 / 3, 0.5],
        'grid-2x2': [0.5, 0.5],
        'main-side-2': [0.6, 0.5],
      },
      savedLayout: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ entries: [], path: '~' }),
      text: async () => '{"entries":[],"path":"~"}',
    }));
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    await act(async () => { await Promise.resolve(); });
    expect(usePaneStore.getState().layout).toBe('single');
    expect(usePaneStore.getState().savedLayout).toBe('cols-2');
  });
});
