import { create } from 'zustand';

interface SessionViewState {
  activeSessionId: string | null;
  open: (sessionId: string) => void;
  close: () => void;
}

export const useSessionViewStore = create<SessionViewState>((set) => ({
  activeSessionId: null,
  open: (sessionId) => set({ activeSessionId: sessionId }),
  close: () => set({ activeSessionId: null }),
}));
