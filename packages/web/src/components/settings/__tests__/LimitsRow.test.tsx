import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LimitsRow } from '../LimitsRow';

describe('LimitsRow', () => {
  it('renders collapsed: dot + label + chips', () => {
    render(
      <LimitsRow
        accountLabel="default"
        windows={[
          { shortLabel: '5h', percent: 21, resetsInText: '4h 12m' },
          { shortLabel: '7d', percent: 8, resetsInText: '6d 1h' },
        ]}
      />,
    );
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('5h')).toBeInTheDocument();
    expect(screen.getByText('21%')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.queryByText('4h 12m')).not.toBeInTheDocument();
  });

  it('expands on click and shows reset times + bars', () => {
    render(
      <LimitsRow
        accountLabel="default"
        windows={[
          { shortLabel: '5h', percent: 21, resetsInText: '4h 12m' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('4h 12m')).toBeInTheDocument();
  });

  it('uses warning color when percent ≥ 50', () => {
    render(
      <LimitsRow accountLabel="x" windows={[{ shortLabel: '5h', percent: 65, resetsInText: '1h' }]} />,
    );
    const percentEl = screen.getByText('65%');
    expect(percentEl.getAttribute('style')).toMatch(/color:/i);
  });

  it('shows stale dot when stale=true', () => {
    render(
      <LimitsRow accountLabel="x" stale staleText="Last updated 6m ago" windows={[]} />,
    );
    expect(screen.getByLabelText(/stale/i)).toBeInTheDocument();
  });
});
