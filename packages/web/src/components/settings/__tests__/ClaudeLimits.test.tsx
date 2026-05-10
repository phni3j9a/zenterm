import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaudeLimits } from '../ClaudeLimits';

const mkClient = (resp: any) => ({
  getClaudeLimits: vi.fn().mockResolvedValue(resp),
}) as any;

describe('ClaudeLimits', () => {
  it('shows unconfigured state', async () => {
    render(<ClaudeLimits client={mkClient({ state: 'unconfigured' })} refreshKey={0} />);
    expect(await screen.findByText(/Not configured|未設定/i)).toBeInTheDocument();
  });

  it('shows pending state', async () => {
    render(<ClaudeLimits client={mkClient({
      state: 'configured',
      accounts: [{ label: 'default', state: 'pending', capturedAt: 0, ageSeconds: 0, stale: false }],
    })} refreshKey={0} />);
    expect(await screen.findByText(/Calculating|計測中/i)).toBeInTheDocument();
  });

  it('shows ok state with windows', async () => {
    render(<ClaudeLimits client={mkClient({
      state: 'configured',
      accounts: [{
        label: 'default', state: 'ok', capturedAt: Math.floor(Date.now() / 1000), ageSeconds: 0, stale: false,
        fiveHour: { usedPercentage: 21, resetsAt: Math.floor(Date.now() / 1000) + 4000 },
      }],
    })} refreshKey={0} />);
    expect(await screen.findByText('21%')).toBeInTheDocument();
  });

  it('shows unavailable state', async () => {
    render(<ClaudeLimits client={mkClient({
      state: 'configured',
      accounts: [{ label: 'default', state: 'unavailable', reason: 'read_error', message: 'permission denied' }],
    })} refreshKey={0} />);
    expect(await screen.findByText(/Unavailable|取得不可/i)).toBeInTheDocument();
  });
});
