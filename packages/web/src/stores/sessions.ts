import { create } from 'zustand';
import type { TmuxSession } from '@zenterm/shared';
import * as api from '../api/client';

interface SessionsState {
  sessions: TmuxSession[];
  activeSessionId: string | null;
  loading: boolean;
  error: string | null;
  openTabs: string[];
  fetchSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<TmuxSession>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newName: string) => Promise<void>;
  setActiveSession: (id: string) => void;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,
  error: null,
  openTabs: [],

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const sessions = await api.listSessions();
      set({ sessions, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createSession: async (name?: string) => {
    const session = await api.createSession(name);
    const { sessions } = get();
    set({ sessions: [...sessions, session] });
    get().openTab(session.name);
    get().setActiveSession(session.name);
    return session;
  },

  deleteSession: async (id: string) => {
    await api.deleteSession(id);
    const { sessions, openTabs, activeSessionId } = get();
    const filtered = sessions.filter((s) => s.name !== id);
    const filteredTabs = openTabs.filter((t) => t !== id);
    set({
      sessions: filtered,
      openTabs: filteredTabs,
      activeSessionId: activeSessionId === id ? (filteredTabs[0] ?? null) : activeSessionId,
    });
  },

  renameSession: async (id: string, newName: string) => {
    const renamed = await api.renameSession(id, newName);
    const { sessions, openTabs, activeSessionId } = get();
    set({
      sessions: sessions.map((s) => (s.name === id ? renamed : s)),
      openTabs: openTabs.map((t) => (t === id ? renamed.name : t)),
      activeSessionId: activeSessionId === id ? renamed.name : activeSessionId,
    });
  },

  setActiveSession: (id: string) => {
    set({ activeSessionId: id });
  },

  openTab: (id: string) => {
    const { openTabs } = get();
    if (!openTabs.includes(id)) {
      set({ openTabs: [...openTabs, id] });
    }
    set({ activeSessionId: id });
  },

  closeTab: (id: string) => {
    const { openTabs, activeSessionId } = get();
    const filtered = openTabs.filter((t) => t !== id);
    set({
      openTabs: filtered,
      activeSessionId: activeSessionId === id ? (filtered[filtered.length - 1] ?? null) : activeSessionId,
    });
  },
}));
