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
import { useSessionsStore } from '@/stores/sessions';

describe('AuthenticatedShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    useSessionViewStore.setState({ activeSessionId: null, activeWindowIndex: null });
    useSessionsStore.setState({ sessions: [], loading: false, error: null });
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

  it('keeps MultiPaneArea mounted (visible) when navigated to /web/files', async () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    useFilesStore.getState().reset();
    useSessionViewStore.setState({ activeSessionId: 'dev', activeWindowIndex: 0 });
    const { usePaneStore } = await import('@/stores/pane');
    usePaneStore.setState({
      layout: 'single',
      panes: [{ kind: 'terminal', sessionId: 'dev', windowIndex: 0 }],
      focusedIndex: 0,
    });
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
    // After the unified-pane refactor MultiPaneArea is always rendered (no longer
    // hidden by /web/files overlay). TerminalPane root must exist and be visible.
    const terminalRoot = container.querySelector('section[data-terminal-root="true"]');
    expect(terminalRoot).not.toBeNull();
    expect((terminalRoot as HTMLElement).style.display).not.toBe('none');
  });

  // Note: path→store sync ("opens session from /web/sessions/:id URL" / window
  // variants, "ignores URL whose session does not exist") was removed when the
  // unified-pane refactor relocated URL state to the hash fragment. URL-based
  // legacy redirects are reintroduced in Task 10. Layout suspend/resume on tab
  // switch was also removed (panes are now kept mounted across all tabs).
});
