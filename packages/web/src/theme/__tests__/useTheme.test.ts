import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../index';
import { useSettingsStore } from '@/stores/settings';
import { darkTokens, lightTokens } from '../tokens';

const setMatchMediaMatches = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({ themeMode: 'system' } as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dark tokens when mode=dark', () => {
    useSettingsStore.setState({ themeMode: 'dark' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(darkTokens);
    expect(result.current.mode).toBe('dark');
  });

  it('returns light tokens when mode=light', () => {
    useSettingsStore.setState({ themeMode: 'light' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(lightTokens);
    expect(result.current.mode).toBe('light');
  });

  it('returns dark when mode=system and system prefers dark', () => {
    setMatchMediaMatches(false); // matches '(prefers-color-scheme: light)' → false → system is dark
    useSettingsStore.setState({ themeMode: 'system' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(darkTokens);
  });

  it('returns light when mode=system and system prefers light', () => {
    setMatchMediaMatches(true); // matches '(prefers-color-scheme: light)' → true
    useSettingsStore.setState({ themeMode: 'system' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(lightTokens);
  });

  it('setMode updates the settings store', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode('light'));
    expect(useSettingsStore.getState().themeMode).toBe('light');
  });
});
