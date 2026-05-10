import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SettingsRoute } from '../settings';
import { LoginRoute } from '../login';
import { useAuthStore } from '@/stores/auth';

describe('SettingsRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects to login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <Routes>
          <Route path="/web/settings" element={<SettingsRoute />} />
          <Route path="/web/login" element={<LoginRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    // When not authenticated, AuthenticatedShell redirects to /web/login
    expect(screen.queryByLabelText(/settings panel/i)).not.toBeInTheDocument();
  });

  it('renders shell with Settings panel when authenticated', () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <Routes>
          <Route path="/web/settings" element={<SettingsRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/settings panel/i)).toBeInTheDocument();
  });
});
