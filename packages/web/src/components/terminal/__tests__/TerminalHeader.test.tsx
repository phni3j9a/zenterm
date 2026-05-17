import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';
import { initI18n } from '@/i18n';
import { TerminalHeader } from '../TerminalHeader';
import type { TerminalStatus, ReconnectInfo } from '../XtermView';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

const baseProps = {
  sessionId: 'zen_dev',
  displayName: 'dev',
  windowName: 'editor',
  status: 'connected' as TerminalStatus,
  reconnectInfo: null as ReconnectInfo | null,
  fontSize: 14,
  onReconnect: () => undefined,
  onZoomIn: () => undefined,
  onZoomOut: () => undefined,
  onZoomReset: () => undefined,
};

describe('TerminalHeader', () => {
  it('renders displayName and window name', () => {
    render(<TerminalHeader {...baseProps} />);
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText(/editor/)).toBeInTheDocument();
  });

  it('falls back to sessionId when displayName is empty', () => {
    render(<TerminalHeader {...baseProps} displayName="" />);
    expect(screen.getByText('zen_dev')).toBeInTheDocument();
  });

  it('shows the status text and aria label for connected', () => {
    render(<TerminalHeader {...baseProps} />);
    expect(screen.getByLabelText(/Connection Connected/i)).toBeInTheDocument();
    expect(screen.getByText(/^Connected$/)).toBeInTheDocument();
  });

  it('renders Reconnect button when status is disconnected', () => {
    const onReconnect = vi.fn();
    render(<TerminalHeader {...baseProps} status="disconnected" onReconnect={onReconnect} />);
    const btn = screen.getByRole('button', { name: /reconnect/i });
    fireEvent.click(btn);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('shows reconnecting eta when ReconnectInfo present', () => {
    render(
      <TerminalHeader
        {...baseProps}
        status="reconnecting"
        reconnectInfo={{ attempt: 3, etaMs: 5000, exhausted: false }}
      />,
    );
    expect(screen.getByTestId('terminal-reconnect-eta')).toHaveTextContent(/5/);
    expect(screen.getByTestId('terminal-reconnect-eta')).toHaveTextContent(/3/);
  });

  it('Zoom buttons call respective handlers', () => {
    const inc = vi.fn();
    const dec = vi.fn();
    const reset = vi.fn();
    render(
      <TerminalHeader
        {...baseProps}
        onZoomIn={inc}
        onZoomOut={dec}
        onZoomReset={reset}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /increase font size/i }));
    fireEvent.click(screen.getByRole('button', { name: /decrease font size/i }));
    fireEvent.click(screen.getByRole('button', { name: /reset font size/i }));
    expect(inc).toHaveBeenCalled();
    expect(dec).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it('disables zoom-out at MIN_FONT_SIZE and zoom-in at MAX_FONT_SIZE', () => {
    const { rerender } = render(<TerminalHeader {...baseProps} fontSize={10} />);
    expect(screen.getByRole('button', { name: /decrease font size/i })).toBeDisabled();
    rerender(<TerminalHeader {...baseProps} fontSize={20} />);
    expect(screen.getByRole('button', { name: /increase font size/i })).toBeDisabled();
  });
});
