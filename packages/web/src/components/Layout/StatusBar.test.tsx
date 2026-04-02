import { render, screen } from '@testing-library/react';
import type { SystemStatus, TmuxSession } from '@zenterm/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBar } from './StatusBar';
import { getSystemStatus } from '../../api/client';
import { useSessionsStore } from '../../stores/sessions';

vi.mock('../../api/client', () => ({
  getSystemStatus: vi.fn(),
}));

const session: TmuxSession = {
  name: 'zen_demo',
  displayName: 'demo',
  created: 0,
  cwd: '/tmp',
};

const status: SystemStatus = {
  cpu: {
    usage: 32,
    cores: 4,
    model: 'ARM',
    loadAvg: [0.1, 0.2, 0.3],
  },
  memory: {
    total: 100,
    used: 54,
    free: 46,
    percent: 54,
  },
  disk: {
    total: 100,
    used: 50,
    free: 50,
    percent: 50,
  },
  temperature: 61,
  uptime: 123,
};

const originalState = useSessionsStore.getState();

describe('StatusBar', () => {
  beforeEach(() => {
    vi.mocked(getSystemStatus).mockReset();
    useSessionsStore.setState({
      sessions: [session],
      activeSessionId: session.name,
    });
  });

  afterEach(() => {
    useSessionsStore.setState({
      sessions: originalState.sessions,
      activeSessionId: originalState.activeSessionId,
    });
  });

  it('renders metrics when the status request succeeds', async () => {
    vi.mocked(getSystemStatus).mockResolvedValueOnce(status);
    render(<StatusBar />);

    expect(await screen.findByText('CPU 32%')).toBeInTheDocument();
    expect(screen.getByText('MEM 54%')).toBeInTheDocument();
    expect(screen.getByText('61°C')).toBeInTheDocument();
  });

  it('renders a fallback when the status request fails', async () => {
    vi.mocked(getSystemStatus).mockRejectedValueOnce(new Error('offline'));
    render(<StatusBar />);

    expect(await screen.findByText('Status unavailable')).toBeInTheDocument();
  });
});
