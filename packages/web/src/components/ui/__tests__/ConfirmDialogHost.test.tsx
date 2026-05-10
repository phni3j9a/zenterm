import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialogHost } from '../ConfirmDialogHost';
import { useUiStore } from '@/stores/ui';

beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
  useUiStore.setState({ confirmDialog: null, toasts: [] });
});

describe('ConfirmDialogHost', () => {
  it('renders nothing when no dialog requested', () => {
    render(<ConfirmDialogHost />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog from uiStore', () => {
    render(<ConfirmDialogHost />);
    act(() => {
      useUiStore.getState().showConfirm({
        title: 'Delete',
        message: 'Sure?',
        onConfirm: vi.fn(),
      });
    });
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('confirm invokes callback then hides dialog', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialogHost />);
    act(() => {
      useUiStore.getState().showConfirm({
        title: 't',
        message: 'm',
        confirmLabel: 'Yes',
        onConfirm,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: /Yes/ }));
    expect(onConfirm).toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog).toBeNull();
  });

  it('cancel hides dialog without invoking onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialogHost />);
    act(() => {
      useUiStore.getState().showConfirm({
        title: 't',
        message: 'm',
        cancelLabel: 'No',
        onConfirm,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: /No/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog).toBeNull();
  });
});
