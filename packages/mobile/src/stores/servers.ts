import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { Server } from '@/src/types';

const STORAGE_KEY = 'ccsuite_servers';

interface ServerInput {
  name: string;
  url: string;
  token: string;
  isDefault?: boolean;
}

interface ServerUpdate {
  name?: string;
  url?: string;
  token?: string;
  isDefault?: boolean;
}

interface ServersState {
  loaded: boolean;
  servers: Server[];
  load: () => Promise<void>;
  addServer: (server: ServerInput) => Promise<Server>;
  updateServer: (id: string, updates: ServerUpdate) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  clear: () => void;
  getDefaultServer: () => Server | null;
}

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '');

const generateId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const normalizeServers = (servers: Server[], preferredDefaultId?: string): Server[] => {
  if (servers.length === 0) {
    return [];
  }

  const preferredExists = preferredDefaultId ? servers.some((server) => server.id === preferredDefaultId) : false;

  if (preferredExists) {
    return servers.map((server) => ({
      ...server,
      isDefault: server.id === preferredDefaultId,
    }));
  }

  const firstDefaultId = servers.find((server) => server.isDefault)?.id ?? servers[0].id;

  return servers.map((server) => ({
    ...server,
    isDefault: server.id === firstDefaultId,
  }));
};

const persistServers = async (servers: Server[]) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(servers));
};

export const useServersStore = create<ServersState>((set, get) => ({
  loaded: false,
  servers: [],
  load: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!raw) {
        set({ servers: [], loaded: true });
        return;
      }

      const parsed = JSON.parse(raw) as Server[];
      set({ servers: normalizeServers(parsed), loaded: true });
    } catch {
      set({ servers: [], loaded: true });
    }
  },
  addServer: async (server) => {
    const nextServer: Server = {
      id: generateId(),
      name: server.name.trim(),
      url: normalizeUrl(server.url),
      token: server.token.trim(),
      isDefault: Boolean(server.isDefault),
    };

    const currentServers = get().servers;
    const nextServers = normalizeServers(
      [...currentServers, nextServer],
      currentServers.length === 0 || nextServer.isDefault ? nextServer.id : undefined,
    );

    set({ servers: nextServers });
    await persistServers(nextServers);

    return nextServers.find((item) => item.id === nextServer.id) ?? nextServer;
  },
  updateServer: async (id, updates) => {
    const nextServers = normalizeServers(
      get().servers.map((server) =>
        server.id === id
          ? {
              ...server,
              ...updates,
              name: updates.name !== undefined ? updates.name.trim() : server.name,
              url: updates.url !== undefined ? normalizeUrl(updates.url) : server.url,
              token: updates.token !== undefined ? updates.token.trim() : server.token,
            }
          : server,
      ),
      updates.isDefault ? id : undefined,
    );

    set({ servers: nextServers });
    await persistServers(nextServers);
  },
  removeServer: async (id) => {
    const nextServers = normalizeServers(get().servers.filter((server) => server.id !== id));
    set({ servers: nextServers });
    await persistServers(nextServers);
  },
  clear: () => {
    set({ servers: [], loaded: true });
  },
  getDefaultServer: () => {
    const servers = get().servers;
    return servers.find((server) => server.isDefault) ?? servers[0] ?? null;
  },
}));
