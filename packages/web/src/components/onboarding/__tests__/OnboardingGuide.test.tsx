import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingGuide } from '../OnboardingGuide';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingGuide', () => {
  it('renders 3 steps', () => {
    render(<OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={() => {}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
  it('marks step 1 as done', () => {
    render(<OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/✓/);
  });
  it('marks step 2 done when tokenEntered', () => {
    render(<OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1].textContent).toMatch(/✓/);
  });
  it('marks step 2 current when not tokenEntered', () => {
    render(<OnboardingGuide tokenEntered={false} sessionsCount={0} onDismiss={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1].getAttribute('aria-current')).toBe('step');
  });
  it('marks step 3 done when sessionsCount > 0', () => {
    render(<OnboardingGuide tokenEntered={true} sessionsCount={1} onDismiss={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[2].textContent).toMatch(/✓/);
  });
  it('calls onDismiss when dismiss button clicked', async () => {
    const handler = vi.fn();
    render(<OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={handler} />);
    await userEvent.click(screen.getByRole('button', { name: /don't show again|dismiss|もう表示しない|次回から表示しない/i }));
    expect(handler).toHaveBeenCalled();
  });
});
