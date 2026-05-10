import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useEventsStore } from '@/stores/events';

const noopActions = {
  onSelect: vi.fn(),
  onCreateSession: vi.fn(),
  onRenameSession: vi.fn(),
  onRequestDeleteSession: vi.fn(),
  onCreateWindow: vi.fn(),
  onRenameWindow: vi.fn(),
  onRequestDeleteWindow: vi.fn(),
};

describe('Sidebar', () => {
  beforeEach(() => {
    useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
  });

  it('renders sessions panel and bottom nav with 3 buttons', () => {
    render(
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sessions tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Files tab/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings tab/i })).toBeDisabled();
  });

  it('shows events status indicator', () => {
    render(
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByLabelText(/Realtime updates/i)).toBeInTheDocument();
  });

  it('reflects connected status', () => {
    useEventsStore.setState({ status: 'connected', reconnectAttempt: 0, lastEvent: null });
    render(
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByLabelText(/Realtime updates: connected/i)).toBeInTheDocument();
  });
});
