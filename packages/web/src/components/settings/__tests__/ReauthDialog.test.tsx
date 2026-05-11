import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReauthDialog } from '../ReauthDialog';
import { useAuthStore } from '@/stores/auth';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
});

describe('ReauthDialog', () => {
  it('verifies token via /api/auth/verify and updates auth store on success', async () => {
    useAuthStore.setState({ token: 'old', gatewayUrl: 'http://example' } as any);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const onClose = vi.fn();
    render(<ReauthDialog open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /verify|submit|ok/i }));
    await waitFor(() => expect(useAuthStore.getState().token).toBe('1234'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error on 401', async () => {
    useAuthStore.setState({ token: 'old', gatewayUrl: 'http://example' } as any);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    render(<ReauthDialog open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: /verify|submit|ok/i }));
    await waitFor(() => expect(screen.getByText(/invalid token/i)).toBeInTheDocument());
    expect(useAuthStore.getState().token).toBe('old');
  });
});
