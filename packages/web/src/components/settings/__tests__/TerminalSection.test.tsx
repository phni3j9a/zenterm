import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalSection } from '../TerminalSection';
import { useSettingsStore, MIN_FONT_SIZE, MAX_FONT_SIZE } from '@/stores/settings';

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState({
    themeMode: 'system',
    language: 'ja',
    fontSize: 14,
  });
});

describe('TerminalSection', () => {
  it('renders current font size', () => {
    useSettingsStore.setState({ fontSize: 14 } as any);
    render(<TerminalSection />);
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('increment button increases font size by 1', () => {
    useSettingsStore.setState({ fontSize: 14 } as any);
    render(<TerminalSection />);
    fireEvent.click(screen.getByRole('button', { name: /increase font size/i }));
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });

  it('decrement button decreases font size by 1', () => {
    useSettingsStore.setState({ fontSize: 14 } as any);
    render(<TerminalSection />);
    fireEvent.click(screen.getByRole('button', { name: /decrease font size/i }));
    expect(useSettingsStore.getState().fontSize).toBe(13);
  });

  it('disables increment at MAX_FONT_SIZE', () => {
    useSettingsStore.setState({ fontSize: MAX_FONT_SIZE } as any);
    render(<TerminalSection />);
    expect(screen.getByRole('button', { name: /increase font size/i })).toBeDisabled();
  });

  it('disables decrement at MIN_FONT_SIZE', () => {
    useSettingsStore.setState({ fontSize: MIN_FONT_SIZE } as any);
    render(<TerminalSection />);
    expect(screen.getByRole('button', { name: /decrease font size/i })).toBeDisabled();
  });
});
