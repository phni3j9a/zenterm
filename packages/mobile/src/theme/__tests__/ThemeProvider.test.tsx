/// <reference types="jest" />

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as ReactNative from 'react-native';

import { useSettingsStore } from '../../stores/settings';
import { AppThemeProvider, useTheme, type AppTheme } from '../ThemeProvider';
import { colors, colorsDark } from '../tokens';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

function ThemeProbe({ onTheme }: { onTheme: (theme: AppTheme) => void }) {
  onTheme(useTheme());
  return null;
}

describe('AppThemeProvider', () => {
  let renderer: ReactTestRenderer | null = null;
  const onTheme = jest.fn();
  let useColorSchemeSpy: jest.SpiedFunction<typeof ReactNative.useColorScheme>;

  beforeEach(() => {
    onTheme.mockReset();
    useColorSchemeSpy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
    useSettingsStore.setState({
      loaded: false,
      settings: {
        fontSize: 14,
        themeMode: 'system',
      },
    });
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
    renderer = null;
    useColorSchemeSpy.mockRestore();
  });

  it('useTheme がシステムライト時にライトトークンを返す', () => {
    act(() => {
      renderer = create(
        <AppThemeProvider>
          <ThemeProbe onTheme={onTheme} />
        </AppThemeProvider>,
      );
    });

    const theme = onTheme.mock.calls.at(-1)?.[0];
    expect(theme.colors).toBe(colors);
    expect(theme.dark).toBe(false);
    expect(theme.navigationTheme.colors.background).toBe(colors.bg);
    expect(theme.typography.heading.fontSize).toBe(20);
    expect(theme.spacing.lg).toBe(16);
  });

  it('themeMode 切り替えで dark/light の colors が変わる', () => {
    useColorSchemeSpy.mockReturnValue('dark');

    act(() => {
      renderer = create(
        <AppThemeProvider>
          <ThemeProbe onTheme={onTheme} />
        </AppThemeProvider>,
      );
    });

    expect(onTheme.mock.calls.at(-1)?.[0].colors).toBe(colorsDark);

    act(() => {
      useSettingsStore.setState((state) => ({
        settings: {
          ...state.settings,
          themeMode: 'light',
        },
      }));
    });

    expect(onTheme.mock.calls.at(-1)?.[0].colors).toBe(colors);
    expect(onTheme.mock.calls.at(-1)?.[0].dark).toBe(false);
  });

  it('useTheme は provider 外で使うと例外を投げる', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      act(() => {
        create(<ThemeProbe onTheme={onTheme} />);
      }),
    ).toThrow('useTheme must be used within AppThemeProvider');

    consoleError.mockRestore();
  });
});
