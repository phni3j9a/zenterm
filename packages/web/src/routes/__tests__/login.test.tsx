import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginRoute } from '../login';
import { useAuthStore } from '@/stores/auth';

/** Paste a 4-digit token into the OTP input (fills all boxes). */
async function pasteOtp(digits: string) {
  const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
  boxes[0].focus();
  await userEvent.paste(digits);
}

describe('LoginRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://gateway.test:18765' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('on successful login, sets auth store and navigates to /web/sessions', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );
    render(
      <MemoryRouter initialEntries={['/web/login']}>
        <Routes>
          <Route path="/web/login" element={<LoginRoute />} />
          <Route path="/web/sessions" element={<div>Sessions Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await pasteOtp('1234');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByText('Sessions Screen')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe('1234');
    expect(useAuthStore.getState().gatewayUrl).toBe('http://gateway.test:18765');
  });

  it('on 401, shows error and stays on login', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    render(
      <MemoryRouter initialEntries={['/web/login']}>
        <Routes>
          <Route path="/web/login" element={<LoginRoute />} />
          <Route path="/web/sessions" element={<div>Sessions Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await pasteOtp('0000');
    await userEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid token/i);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
