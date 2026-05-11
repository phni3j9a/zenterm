import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TerminalHeader } from '../TerminalHeader';

const baseProps = {
  sessionId: 'sX',
  windowIndex: 0,
  displayName: 'demo',
  windowName: 'w',
  status: 'connected' as const,
  reconnectInfo: null,
  fontSize: 14,
  onReconnect: () => undefined,
  onCopySessionId: () => undefined,
  onZoomIn: () => undefined,
  onZoomOut: () => undefined,
  onZoomReset: () => undefined,
};

describe('TerminalHeader tooltips', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows tooltip when hovering the ID button', () => {
    render(<TerminalHeader {...baseProps} />);
    const idBtn = screen.getByRole('button', { name: /copy session id/i });
    fireEvent.mouseEnter(idBtn);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('tooltip')).toHaveTextContent(/copy session id/i);
  });

  it('shows tooltip when hovering the zoom-in button', () => {
    render(<TerminalHeader {...baseProps} />);
    const btn = screen.getByRole('button', { name: /increase font size/i });
    fireEvent.mouseEnter(btn);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('tooltip')).toHaveTextContent(/increase font size/i);
  });
});
