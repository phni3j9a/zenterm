import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GatewaySection } from '../GatewaySection';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: '1234', gatewayUrl: 'http://10.0.0.1:18765' });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => vi.restoreAllMocks());

describe('GatewaySection', () => {
  it('renders connected URL and masked token', () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    expect(screen.getByText('http://10.0.0.1:18765')).toBeInTheDocument();
    expect(screen.getByText(/••/)).toBeInTheDocument();
    expect(screen.getByText('0.5.7')).toBeInTheDocument();
  });

  it('Copy URL writes origin/web to clipboard and pushes toast', async () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /copy.*url/i }));
    await waitFor(() => {
      expect((navigator.clipboard.writeText as any)).toHaveBeenCalled();
    });
    expect(useUiStore.getState().toasts.length).toBeGreaterThan(0);
  });

  it('Show QR opens the modal', () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /show.*qr/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Logout opens confirm; confirming clears auth', async () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    const confirm = useUiStore.getState().confirmDialog;
    expect(confirm).not.toBeNull();
    confirm?.onConfirm();
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });
});
