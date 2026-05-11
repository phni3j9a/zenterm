import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppearanceSection } from '../AppearanceSection';
import { useSettingsStore, DEFAULT_FONT_SIZE } from '@/stores/settings';

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState({
    themeMode: 'system',
    language: 'ja',
    fontSize: DEFAULT_FONT_SIZE,
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => vi.restoreAllMocks());

describe('AppearanceSection', () => {
  it('renders three theme buttons; current mode is aria-pressed', () => {
    useSettingsStore.setState({ themeMode: 'dark' } as any);
    render(<AppearanceSection />);
    const dark = screen.getByRole('button', { name: /^Dark$/ });
    const light = screen.getByRole('button', { name: /^Light$/ });
    const system = screen.getByRole('button', { name: /^System$/ });
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    expect(light.getAttribute('aria-pressed')).toBe('false');
    expect(system.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a theme button updates the store', () => {
    render(<AppearanceSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Light$/ }));
    expect(useSettingsStore.getState().themeMode).toBe('light');
  });

  it('renders language select with current value', () => {
    useSettingsStore.setState({ language: 'ja' } as any);
    render(<AppearanceSection />);
    const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
    expect(select.value).toBe('ja');
  });

  it('changing language select updates the store', () => {
    render(<AppearanceSection />);
    const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'en' } });
    expect(useSettingsStore.getState().language).toBe('en');
  });
});
