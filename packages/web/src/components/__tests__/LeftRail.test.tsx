import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LeftRail } from '../LeftRail';

function renderLeftRail(overrides: Partial<Parameters<typeof LeftRail>[0]> = {}) {
  const defaults = {
    activeTab: 'sessions' as const,
    onSelectTab: vi.fn(),
    onLogout: vi.fn(),
    rateLimitsWarning: false,
  };
  const props = { ...defaults, ...overrides };
  return render(
    <MemoryRouter>
      <LeftRail {...props} />
    </MemoryRouter>,
  );
}

describe('LeftRail', () => {
  it('renders 3 tabs', () => {
    renderLeftRail();
    const tablist = screen.getByRole('tablist');
    const tabs = screen.getAllByRole('tab');
    expect(tablist).toBeInTheDocument();
    expect(tabs).toHaveLength(3);
  });

  it('active tab has aria-selected=true', () => {
    renderLeftRail({ activeTab: 'files' });
    const filesTab = screen.getByRole('tab', { name: /files/i });
    expect(filesTab).toHaveAttribute('aria-selected', 'true');
    const sessionsTab = screen.getByRole('tab', { name: /sessions/i });
    expect(sessionsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking a tab calls onSelectTab with the tab id', async () => {
    const onSelectTab = vi.fn();
    renderLeftRail({ onSelectTab });
    await userEvent.click(screen.getByRole('tab', { name: /files/i }));
    expect(onSelectTab).toHaveBeenCalledWith('files');
  });

  it('warning dot is visible when rateLimitsWarning=true', () => {
    renderLeftRail({ rateLimitsWarning: true });
    expect(screen.getByLabelText(/rate limits warning/i)).toBeInTheDocument();
  });

  it('renders a logout button', () => {
    renderLeftRail();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('ArrowDown moves focus from sessions tab to files tab', async () => {
    renderLeftRail({ activeTab: 'sessions' });
    const sessionsTab = screen.getByRole('tab', { name: /sessions/i });
    const filesTab = screen.getByRole('tab', { name: /files/i });
    sessionsTab.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(filesTab).toHaveFocus();
  });
});
