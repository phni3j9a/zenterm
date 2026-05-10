import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodexLimits } from '../CodexLimits';

const mkClient = (resp: any) => ({ getCodexLimits: vi.fn().mockResolvedValue(resp) }) as any;

describe('CodexLimits', () => {
  it('shows unconfigured', async () => {
    render(<CodexLimits client={mkClient({ state: 'unconfigured' })} refreshKey={0} />);
    expect(await screen.findByText(/Not configured|未設定/i)).toBeInTheDocument();
  });

  it('shows ok with windows', async () => {
    render(<CodexLimits client={mkClient({
      state: 'configured',
      accounts: [{
        label: 'default', state: 'ok', capturedAt: Math.floor(Date.now() / 1000), ageSeconds: 0, stale: false,
        fiveHour: { usedPercentage: 8, resetsAt: Math.floor(Date.now() / 1000) + 4000 },
      }],
    })} refreshKey={0} />);
    expect(await screen.findByText('8%')).toBeInTheDocument();
  });
});
