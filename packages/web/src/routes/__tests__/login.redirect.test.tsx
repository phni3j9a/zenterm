import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginRoute } from '../login';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/api/client', () => ({
  ApiClient: class {
    constructor(public url: string, public token: string) {}
    async verifyToken() { return true; }
  },
}));

function Wrap({ initial }: { initial: string }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/web/login" element={<LoginRoute />} />
        <Route path="/web/sessions/work" element={<div data-testid="dest">sessions/work</div>} />
        <Route path="/web/sessions" element={<div data-testid="dest">sessions</div>} />
        <Route path="/web/files/home" element={<div data-testid="dest">files/home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginRoute redirect preserve', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, gatewayUrl: null });
    localStorage.clear();
  });

  it('redirects to default /web/sessions when no state.from', async () => {
    render(<Wrap initial="/web/login" />);
    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: '4812' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByTestId('dest')).toHaveTextContent('sessions'));
  });

  it('redirects to state.from when set', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/web/login', state: { from: { pathname: '/web/sessions/work', search: '', hash: '' } } }]}>
        <Routes>
          <Route path="/web/login" element={<LoginRoute />} />
          <Route path="/web/sessions/work" element={<div data-testid="dest">sessions/work</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: '4812' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByTestId('dest')).toHaveTextContent('sessions/work'));
  });

  it('falls back to /web/sessions when state.from is /web/login (loop avoidance)', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/web/login', state: { from: { pathname: '/web/login' } } }]}>
        <Routes>
          <Route path="/web/login" element={<LoginRoute />} />
          <Route path="/web/sessions" element={<div data-testid="dest">sessions</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: '4812' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByTestId('dest')).toHaveTextContent('sessions'));
  });
});
