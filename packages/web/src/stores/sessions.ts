import { create } from 'zustand';
import type { TmuxSession } from '@zenterm/shared';

export interface SessionsApiClient {
  listSessions: () => Promise<TmuxSession[]>;
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
  refetch: (client: SessionsApiClient) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set) => ({
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
}));
