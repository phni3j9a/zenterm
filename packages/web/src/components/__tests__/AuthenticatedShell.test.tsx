import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedShell } from '../AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';

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
});
