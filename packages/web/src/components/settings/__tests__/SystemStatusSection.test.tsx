import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemStatusSection } from '../SystemStatusSection';

const mkStatus = (overrides: Partial<any> = {}) => ({
  cpu: { usage: 5, cores: 6, model: 'i5', loadAvg: [0.4, 0.55, 0.61] },
  memory: { total: 32_000_000_000, used: 6_200_000_000, free: 25_800_000_000, percent: 19 },
  disk: { total: 256e9, used: 100e9, free: 156e9, percent: 39 },
  temperature: null,
  uptime: 240_000, // ~2d 18h 40m
  gatewayVersion: '0.5.7',
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SystemStatusSection', () => {
  it('initial fetch shows uptime, load avg, memory, gatewayVersion', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockResolvedValue(mkStatus()) };
    const onVersion = vi.fn();
    render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={onVersion} />);
    await vi.waitFor(() => expect(screen.getByText(/2d/)).toBeInTheDocument());
    expect(screen.getByText(/0\.40 \/ 0\.55 \/ 0\.61/)).toBeInTheDocument();
    expect(screen.getByText(/19%/)).toBeInTheDocument();
    expect(onVersion).toHaveBeenCalledWith('0.5.7');
  });

  it('polls every 5 seconds', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockResolvedValue(mkStatus()) };
    render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={() => {}} />);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(1));
    vi.advanceTimersByTime(5000);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(2));
    vi.advanceTimersByTime(5000);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(3));
  });

  it('shows error message on fetch failure', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockRejectedValue(new Error('boom')) };
    render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={() => {}} />);
    await vi.waitFor(() => expect(screen.getByText(/Status unavailable/i)).toBeInTheDocument());
  });

  it('stops polling on unmount', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockResolvedValue(mkStatus()) };
    const { unmount } = render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={() => {}} />);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(1));
    unmount();
    vi.advanceTimersByTime(20000);
    expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(1);
  });
});
