import { create } from 'zustand';
import { useAuthStore } from './auth';

export interface ServerProfile {
  id: string;
  label: string;
  url: string;
  token: string;
}

interface ServersState {
  profiles: ServerProfile[];
  activeServerId: string | null;
  addServer: (label: string, url: string, token: string) => string;
  removeServer: (id: string) => void;
  updateServer: (id: string, patch: Partial<Omit<ServerProfile, 'id'>>) => void;
  switchServer: (id: string) => void;
  syncFromAuth: () => void;
}

const STORAGE_KEY = 'zenterm_servers';

function genId(): string {
  return `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadProfiles(): { profiles: ServerProfile[]; activeServerId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        profiles: data.profiles ?? [],
        activeServerId: data.activeServerId ?? null,
      };
    }
  } catch { /* ignore */ }
  return { profiles: [], activeServerId: null };
}

function saveState(profiles: ServerProfile[], activeServerId: string | null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ profiles, activeServerId }));
}

export const useServersStore = create<ServersState>((set, get) => ({
  ...loadProfiles(),

  addServer: (label, url, token) => {
    const id = genId();
    const normalizedUrl = url.replace(/\/+$/, '');
    const profile: ServerProfile = { id, label, url: normalizedUrl, token };
    const next = [...get().profiles, profile];
    const activeId = get().activeServerId ?? id;
    saveState(next, activeId);
    set({ profiles: next, activeServerId: activeId });
    return id;
  },

  removeServer: (id) => {
    const { profiles, activeServerId } = get();
    const next = profiles.filter((p) => p.id !== id);
    const nextActive = activeServerId === id ? (next[0]?.id ?? null) : activeServerId;
    saveState(next, nextActive);
    set({ profiles: next, activeServerId: nextActive });
    // If removed the active server and there's a fallback, switch to it
    if (activeServerId === id && nextActive) {
      get().switchServer(nextActive);
    }
  },

  updateServer: (id, patch) => {
    const { profiles, activeServerId } = get();
    const next = profiles.map((p) =>
      p.id === id ? { ...p, ...patch, url: patch.url ? patch.url.replace(/\/+$/, '') : p.url } : p,
    );
    saveState(next, activeServerId);
    set({ profiles: next });
    // If updating the active server's url or token, sync auth
    if (id === activeServerId) {
      const updated = next.find((p) => p.id === id);
      if (updated) {
        useAuthStore.getState().setAuth(updated.token, updated.url);
      }
    }
  },

  switchServer: (id) => {
    const { profiles } = get();
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    saveState(profiles, id);
    set({ activeServerId: id });
    // Update auth store to point to the new server
    useAuthStore.getState().setAuth(profile.token, profile.url);
  },

  // Import current auth as a server profile if no profiles exist
  syncFromAuth: () => {
    const { profiles } = get();
    if (profiles.length > 0) return; // Already has profiles
    const auth = useAuthStore.getState();
    if (!auth.token) return;
    const id = genId();
    const profile: ServerProfile = {
      id,
      label: auth.gatewayUrl
        ? new URL(auth.gatewayUrl).hostname || 'Local'
        : 'Local',
      url: auth.gatewayUrl,
      token: auth.token,
    };
    saveState([profile], id);
    set({ profiles: [profile], activeServerId: id });
  },
}));
