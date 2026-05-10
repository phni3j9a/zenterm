import { create } from 'zustand';

interface SessionViewState {
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  open: (sessionId: string, windowIndex?: number) => void;
  close: () => void;
  setWindow: (windowIndex: number) => void;
}

export const useSessionViewStore = create<SessionViewState>((set) => ({
  activeSessionId: null,
  activeWindowIndex: null,
  open: (sessionId, windowIndex) =>
    set({ activeSessionId: sessionId, activeWindowIndex: windowIndex ?? null }),
  close: () => set({ activeSessionId: null, activeWindowIndex: null }),
  setWindow: (windowIndex) => set({ activeWindowIndex: windowIndex }),
}));
