import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useEventsStore } from '@/stores/events';

describe('Sidebar', () => {
  beforeEach(() => {
    useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
  });

  it('renders sessions panel and bottom nav with 3 buttons', () => {
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sessions tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Files tab/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings tab/i })).toBeDisabled();
  });

  it('shows events status indicator (idle by default)', () => {
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Realtime updates/i)).toBeInTheDocument();
  });

  it('reflects connected status', () => {
    useEventsStore.setState({ status: 'connected', reconnectAttempt: 0, lastEvent: null });
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Realtime updates: connected/i)).toBeInTheDocument();
  });

  it('reflects reconnecting status with attempt count', () => {
    useEventsStore.setState({ status: 'reconnecting', reconnectAttempt: 3, lastEvent: null });
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Realtime updates: reconnecting \(attempt 3\)/i)).toBeInTheDocument();
  });
});
