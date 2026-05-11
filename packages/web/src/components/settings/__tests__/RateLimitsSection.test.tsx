import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RateLimitsSection } from '../RateLimitsSection';

describe('RateLimitsSection', () => {
  it('refresh button triggers re-fetch in both Claude and Codex', async () => {
    const claudeFetch = vi.fn().mockResolvedValue({ state: 'unconfigured' });
    const codexFetch = vi.fn().mockResolvedValue({ state: 'unconfigured' });
    const client = { getClaudeLimits: claudeFetch, getCodexLimits: codexFetch } as any;

    render(<RateLimitsSection client={client} />);
    await waitFor(() => expect(claudeFetch).toHaveBeenCalledTimes(1));
    expect(codexFetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(claudeFetch).toHaveBeenCalledTimes(2));
    expect(codexFetch).toHaveBeenCalledTimes(2);
  });
});
