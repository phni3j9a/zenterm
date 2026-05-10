import { describe, expect, it, beforeEach } from 'vitest';
import { useEventsStore } from '../events';

describe('useEventsStore', () => {
  beforeEach(() => {
    useEventsStore.setState({
      status: 'idle',
      reconnectAttempt: 0,
      lastEvent: null,
    });
  });

  it('starts in idle status with no event', () => {
    const s = useEventsStore.getState();
    expect(s.status).toBe('idle');
    expect(s.reconnectAttempt).toBe(0);
    expect(s.lastEvent).toBeNull();
  });

  it('setStatus updates status', () => {
    useEventsStore.getState().setStatus('connected');
    expect(useEventsStore.getState().status).toBe('connected');
  });

  it('setReconnectAttempt updates attempt count', () => {
    useEventsStore.getState().setReconnectAttempt(5);
    expect(useEventsStore.getState().reconnectAttempt).toBe(5);
  });

  it('setLastEvent records most recent event', () => {
    useEventsStore.getState().setLastEvent({ type: 'sessions-changed' });
    expect(useEventsStore.getState().lastEvent).toEqual({ type: 'sessions-changed' });
    useEventsStore.getState().setLastEvent({ type: 'windows-changed' });
    expect(useEventsStore.getState().lastEvent).toEqual({ type: 'windows-changed' });
  });
});
