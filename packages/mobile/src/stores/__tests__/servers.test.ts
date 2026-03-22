/// <reference types="jest" />

import * as SecureStore from 'expo-secure-store';
import { act } from 'react-test-renderer';

import { useServersStore } from '../servers';

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('useServersStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useServersStore.setState({
      loaded: false,
      servers: [],
    });
  });

  it('初期状態が空配列である', () => {
    expect(useServersStore.getState().servers).toEqual([]);
  });

  it('addServer でサーバーを追加できる', async () => {
    let createdId = '';

    await act(async () => {
      const created = await useServersStore.getState().addServer({
        name: ' Home ',
        url: 'https://example.com/',
        token: ' secret ',
      });
      createdId = created.id;
    });

    expect(useServersStore.getState().servers).toEqual([
      expect.objectContaining({
        id: createdId,
        name: 'Home',
        url: 'https://example.com',
        token: 'secret',
        isDefault: true,
      }),
    ]);
  });

  it('updateServer でサーバー情報を更新できる', async () => {
    let serverId = '';

    await act(async () => {
      const created = await useServersStore.getState().addServer({
        name: 'Home',
        url: 'https://example.com',
        token: 'secret',
      });
      serverId = created.id;
    });

    await act(async () => {
      await useServersStore.getState().updateServer(serverId, {
        name: ' Office ',
        url: 'https://office.example.com/',
        token: ' next-token ',
      });
    });

    expect(useServersStore.getState().servers).toEqual([
      expect.objectContaining({
        id: serverId,
        name: 'Office',
        url: 'https://office.example.com',
        token: 'next-token',
      }),
    ]);
  });

  it('removeServer でサーバーを削除できる', async () => {
    let serverId = '';

    await act(async () => {
      const created = await useServersStore.getState().addServer({
        name: 'Home',
        url: 'https://example.com',
        token: 'secret',
      });
      serverId = created.id;
    });

    await act(async () => {
      await useServersStore.getState().removeServer(serverId);
    });

    expect(useServersStore.getState().servers).toEqual([]);
  });

  it('getDefaultServer は isDefault=true のサーバーを返す', async () => {
    await act(async () => {
      await useServersStore.getState().addServer({
        name: 'Home',
        url: 'https://home.example.com',
        token: 'home-token',
      });
      await useServersStore.getState().addServer({
        name: 'Office',
        url: 'https://office.example.com',
        token: 'office-token',
        isDefault: true,
      });
    });

    expect(useServersStore.getState().getDefaultServer()).toEqual(
      expect.objectContaining({
        name: 'Office',
        isDefault: true,
      }),
    );
  });

  it('getDefaultServer はデフォルト未指定時に最初のサーバーを返す', async () => {
    await act(async () => {
      await useServersStore.getState().addServer({
        name: 'Home',
        url: 'https://home.example.com',
        token: 'home-token',
      });
      await useServersStore.getState().addServer({
        name: 'Office',
        url: 'https://office.example.com',
        token: 'office-token',
      });
    });

    expect(useServersStore.getState().getDefaultServer()).toEqual(
      expect.objectContaining({
        name: 'Home',
        isDefault: true,
      }),
    );
  });

  it('追加・更新・削除時に SecureStore へ永続化する', async () => {
    let serverId = '';

    await act(async () => {
      const created = await useServersStore.getState().addServer({
        name: 'Home',
        url: 'https://example.com',
        token: 'secret',
      });
      serverId = created.id;
    });

    await act(async () => {
      await useServersStore.getState().updateServer(serverId, { name: 'Updated' });
      await useServersStore.getState().removeServer(serverId);
    });

    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledTimes(3);
    expect(mockedSecureStore.setItemAsync).toHaveBeenLastCalledWith('zenterm_servers', '[]');
  });
});
