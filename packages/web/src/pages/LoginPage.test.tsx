import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { verifyAuth } from '../api/client';
import { useAuthStore } from '../stores/auth';

const STORAGE_KEY = 'zenterm_auth';
const navigateMock = vi.fn();
const setAuth = useAuthStore.getState().setAuth;
const logout = useAuthStore.getState().logout;

vi.mock('../api/client', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function renderLoginPage(): void {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    navigateMock.mockReset();
    vi.mocked(verifyAuth).mockReset();
    useAuthStore.setState({
      token: null,
      gatewayUrl: '',
      setAuth,
      logout,
    });
  });

  afterEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: null,
      gatewayUrl: '',
      setAuth,
      logout,
    });
  });

  it('stores auth only after verification succeeds', async () => {
    const verify = createDeferred<{ ok: boolean }>();

    vi.mocked(verifyAuth).mockReturnValueOnce(verify.promise);
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Gateway URL'), {
      target: { value: 'http://gateway///' },
    });
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: '  valid-token  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ token: 'valid-token', gatewayUrl: 'http://gateway' }),
    );
    expect(useAuthStore.getState().token).toBeNull();

    verify.resolve({ ok: true });

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('valid-token');
    });
    expect(useAuthStore.getState().gatewayUrl).toBe('http://gateway');
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });

  it('clears temporary auth and shows an error when verification fails', async () => {
    vi.mocked(verifyAuth).mockRejectedValueOnce(new Error('Unauthorized'));
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Gateway URL'), {
      target: { value: 'http://gateway' },
    });
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: 'bad-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByTestId('login-error')).toHaveTextContent(
        'Authentication failed. Check your token and server URL.',
      );
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
