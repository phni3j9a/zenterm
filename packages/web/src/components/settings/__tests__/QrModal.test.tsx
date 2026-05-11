import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QrModal } from '../QrModal';

beforeAll(() => {
  // jsdom doesn't implement <dialog>; reuse Phase 2a polyfill pattern
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
});

describe('QrModal', () => {
  it('renders the QR SVG with given URL when open', () => {
    render(<QrModal open url="zenterm://connect?url=x&token=t" onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const svg = screen.getByRole('dialog').querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('shows the raw URL as fallback text', () => {
    render(<QrModal open url="zenterm://connect?url=x&token=t" onClose={() => {}} />);
    expect(screen.getByText(/zenterm:\/\/connect\?url=x&token=t/)).toBeInTheDocument();
  });

  it('clicking close calls onClose', () => {
    const onClose = vi.fn();
    render(<QrModal open url="zenterm://x" onClose={onClose} />);
    screen.getByRole('button', { name: /close/i }).click();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when not open', () => {
    render(<QrModal open={false} url="zenterm://x" onClose={() => {}} />);
    const dialog = screen.queryByRole('dialog', { hidden: true });
    expect(dialog?.hasAttribute('open')).not.toBe(true);
  });
});
