import { create } from 'zustand';
import type { TmuxEvent } from '@zenterm/shared';

export type EventsStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface EventsState {
  status: EventsStatus;
  reconnectAttempt: number;
  lastEvent: TmuxEvent | null;
  setStatus: (status: EventsStatus) => void;
  setReconnectAttempt: (attempt: number) => void;
  setLastEvent: (event: TmuxEvent) => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  status: 'idle',
  reconnectAttempt: 0,
  lastEvent: null,
  setStatus: (status) => set({ status }),
  setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt }),
  setLastEvent: (lastEvent) => set({ lastEvent }),
}));
