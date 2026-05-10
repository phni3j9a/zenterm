import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastViewport } from '../ToastViewport';
import { useUiStore } from '@/stores/ui';

describe('ToastViewport', () => {
  beforeEach(() => {
    useUiStore.setState({ confirmDialog: null, toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no toasts initially', () => {
    render(<ToastViewport />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an error toast with role=alert', () => {
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'error', message: 'boom' });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('renders an info toast with role=status', () => {
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'info', message: 'hi' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('hi');
  });

  it('manual dismiss via close button', async () => {
    vi.useRealTimers();
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'info', message: 'msg' });
    });
    await userEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByText('msg')).not.toBeInTheDocument();
  });

  it('auto-dismisses after default duration', () => {
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'info', message: 'auto' });
    });
    expect(screen.getByText('auto')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('auto')).not.toBeInTheDocument();
  });
});
