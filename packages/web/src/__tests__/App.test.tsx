import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { useAuthStore } from '../stores/auth';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects unauthed user to /web/login showing the form', () => {
    render(
      <MemoryRouter initialEntries={['/web']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /Sign in to ZenTerm/i })).toBeInTheDocument();
  });

  it('shows sessions screen when authed', async () => {
    useAuthStore.setState({ token: '1234', gatewayUrl: 'http://gateway.test:18765' });
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText(/Sessions panel/i)).toBeInTheDocument();
  });

  it('renders FilesRoute on /web/files', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    useAuthStore.setState({ token: '4790', gatewayUrl: 'http://gw' });
    window.history.pushState({}, '', '/web/files');
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <App />
      </MemoryRouter>,
    );
    const matches = await screen.findAllByLabelText(/files panel/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
