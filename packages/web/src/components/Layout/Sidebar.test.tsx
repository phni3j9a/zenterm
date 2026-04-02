import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { useSessionsStore } from '../../stores/sessions';

vi.mock('../FileManager/FileBrowser', () => ({
  FileBrowser: () => <div>File Browser</div>,
}));

const originalState = useSessionsStore.getState();

describe('Sidebar', () => {
  beforeEach(() => {
    useSessionsStore.setState({
      sessions: [],
      activeSessionId: null,
      loading: false,
      error: null,
      openTabs: [],
      fetchSessions: vi.fn(async () => {}),
      createSession: vi.fn(async () => ({
        name: 'zen_new',
        displayName: 'new',
        created: 0,
        cwd: '~',
      })),
      deleteSession: vi.fn(async () => {}),
      renameSession: vi.fn(async () => {}),
      openTab: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    useSessionsStore.setState({
      sessions: originalState.sessions,
      activeSessionId: originalState.activeSessionId,
      loading: originalState.loading,
      error: originalState.error,
      openTabs: originalState.openTabs,
      fetchSessions: originalState.fetchSessions,
      createSession: originalState.createSession,
      deleteSession: originalState.deleteSession,
      renameSession: originalState.renameSession,
      setActiveSession: originalState.setActiveSession,
      openTab: originalState.openTab,
      closeTab: originalState.closeTab,
    });
  });

  it('shows the session error message', async () => {
    const fetchSessions = vi.fn(async () => {});

    useSessionsStore.setState({
      error: 'Failed to load sessions',
      fetchSessions,
    });
    render(<Sidebar />);

    await waitFor(() => {
      expect(fetchSessions).toHaveBeenCalledOnce();
    });
    expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
  });

  it('confirms before deleting a session', async () => {
    const fetchSessions = vi.fn(async () => {});
    const deleteSession = vi.fn(async () => {});

    useSessionsStore.setState({
      fetchSessions,
      deleteSession,
      sessions: [
        { name: 'zen_demo', displayName: 'demo', created: 0, cwd: '~' },
      ],
    });
    render(<Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(screen.getByText('Delete Session')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('zen_demo');
    });
  });

  it('refreshes sessions on interval and when the page becomes visible', async () => {
    vi.useFakeTimers();
    const fetchSessions = vi.fn(async () => {});

    useSessionsStore.setState({ fetchSessions });
    render(<Sidebar />);
    expect(fetchSessions).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(fetchSessions).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));
    expect(fetchSessions).toHaveBeenCalledTimes(3);
  });
});
