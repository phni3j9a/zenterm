import { create } from 'zustand';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useSessionViewStore } from './sessionView';

export interface SessionsApiClient {
  listSessions: () => Promise<TmuxSession[]>;
  createSession: (body?: { name?: string }) => Promise<TmuxSession>;
  renameSession: (sessionId: string, body: { name: string }) => Promise<TmuxSession>;
  killSession: (sessionId: string) => Promise<{ ok: true }>;
  createWindow: (sessionId: string, body?: { name?: string }) => Promise<TmuxWindow>;
  renameWindow: (
    sessionId: string,
    windowIndex: number,
    body: { name: string },
  ) => Promise<TmuxWindow>;
  killWindow: (sessionId: string, windowIndex: number) => Promise<{ ok: true }>;
}

interface SessionsState {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  setSessions: (sessions: TmuxSession[]) => void;
  upsert: (session: TmuxSession) => void;
  remove: (name: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refetch: (client: Pick<SessionsApiClient, 'listSessions'>) => Promise<void>;
  create: (
    client: Pick<SessionsApiClient, 'createSession'>,
    body?: { name?: string },
  ) => Promise<TmuxSession>;
  rename: (
    client: Pick<SessionsApiClient, 'renameSession'>,
    currentId: string,
    newName: string,
  ) => Promise<TmuxSession>;
  removeSession: (
    client: Pick<SessionsApiClient, 'killSession'>,
    id: string,
  ) => Promise<void>;
}

function fallbackAfterRemove(removedDisplayName: string, remaining: TmuxSession[]): void {
  const view = useSessionViewStore.getState();
  if (view.activeSessionId !== removedDisplayName) return;
  const next = remaining.find((s) => s.displayName !== removedDisplayName);
  if (next) {
    view.open(next.displayName, next.windows?.[0]?.index ?? 0);
  } else {
    view.close();
  }
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  setSessions: (sessions) => set({ sessions }),
  upsert: (session) =>
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.name === session.name);
      if (idx === -1) return { sessions: [...state.sessions, session] };
      const next = [...state.sessions];
      next[idx] = session;
      return { sessions: next };
    }),
  remove: (name) =>
    set((state) => ({ sessions: state.sessions.filter((s) => s.name !== name) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  refetch: async (client) => {
    set({ loading: true });
    try {
      const next = await client.listSessions();
      set({ sessions: next, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: message });
    }
  },
  create: async (client, body) => {
    const created = await client.createSession(body);
    set({ sessions: [...get().sessions, created] });
    return created;
  },
  rename: async (client, currentId, newName) => {
    const updated = await client.renameSession(currentId, { name: newName });
    set({
      sessions: get().sessions.map((s) =>
        s.displayName === currentId ? updated : s,
      ),
    });
    const view = useSessionViewStore.getState();
    if (view.activeSessionId === currentId) {
      view.open(updated.displayName, view.activeWindowIndex ?? 0);
    }
    return updated;
  },
  removeSession: async (client, id) => {
    await client.killSession(id);
    const remaining = get().sessions.filter((s) => s.displayName !== id);
    set({ sessions: remaining });
    fallbackAfterRemove(id, remaining);
  },
}));
