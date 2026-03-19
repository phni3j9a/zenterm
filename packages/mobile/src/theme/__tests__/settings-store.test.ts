/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';

import { useSettingsStore } from '../../stores/settings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('useSettingsStore', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    useSettingsStore.setState({
      loaded: false,
      settings: {
        fontSize: 14,
        themeMode: 'system',
      },
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('themeMode を読み込んで既定値とマージする', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ themeMode: 'dark' }));

    await act(async () => {
      await useSettingsStore.getState().load();
    });

    expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith('palmsh_settings');
    expect(useSettingsStore.getState().loaded).toBe(true);
    expect(useSettingsStore.getState().settings).toEqual({
      fontSize: 14,
      themeMode: 'dark',
    });
  });

  it('themeMode 更新時に永続化する', async () => {
    await act(async () => {
      await useSettingsStore.getState().updateSettings({ themeMode: 'light' });
    });

    expect(useSettingsStore.getState().settings.themeMode).toBe('light');
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      'palmsh_settings',
      JSON.stringify({
        fontSize: 14,
        themeMode: 'light',
      }),
    );
  });

  it('永続化に失敗したら settings をロールバックする', async () => {
    const error = new Error('write failed');
    mockedAsyncStorage.setItem.mockRejectedValueOnce(error);

    await act(async () => {
      await useSettingsStore.getState().updateSettings({ themeMode: 'light' });
    });

    expect(useSettingsStore.getState().settings).toEqual({
      fontSize: 14,
      themeMode: 'system',
    });
    expect(warnSpy).toHaveBeenCalledWith('Failed to persist settings:', error);
  });

  it('reset で themeMode を既定値へ戻す', async () => {
    useSettingsStore.setState({
      loaded: true,
      settings: {
        fontSize: 16,
        themeMode: 'dark',
      },
    });

    await act(async () => {
      await useSettingsStore.getState().reset();
    });

    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith('palmsh_settings');
    expect(useSettingsStore.getState().settings).toEqual({
      fontSize: 14,
      themeMode: 'system',
    });
  });

  it('reset の永続化削除に失敗したら settings をロールバックする', async () => {
    const error = new Error('remove failed');
    mockedAsyncStorage.removeItem.mockRejectedValueOnce(error);
    useSettingsStore.setState({
      loaded: true,
      settings: {
        fontSize: 16,
        themeMode: 'dark',
      },
    });

    await act(async () => {
      await useSettingsStore.getState().reset();
    });

    expect(useSettingsStore.getState().settings).toEqual({
      fontSize: 16,
      themeMode: 'dark',
    });
    expect(warnSpy).toHaveBeenCalledWith('Failed to reset settings:', error);
  });
});
