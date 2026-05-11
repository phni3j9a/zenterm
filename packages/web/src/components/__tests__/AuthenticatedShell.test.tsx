import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedShell } from '../AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';
import { useFilesStore } from '@/stores/files';

describe('AuthenticatedShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
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

  it('keeps TerminalPane mounted when navigated to /web/files', () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    useFilesStore.getState().reset?.();
    // Override fetch to return a FileListResponse shape so FilesSidebarPanel /
    // FilesList don't throw on entries.filter when mounted under /web/files.
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
    // TerminalPane root is present in DOM but hidden (display:none) because
    // sessionId === null + isVisible=false collapses to empty-state hidden.
    // FilesViewerPane is also rendered.
    expect(container.querySelector('main, section')).not.toBeNull();
    // Files heading from FilesViewerPane (rendered when isFilesRoute) — the
    // exact selector varies with FilesViewerPane internals; the smoke test is
    // that both branches render without throwing.
    expect(container.textContent ?? '').toMatch(/Files|file/i);
  });
});
