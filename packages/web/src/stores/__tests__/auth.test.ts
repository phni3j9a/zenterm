import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from '../auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
  });

  it('initial state is unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.gatewayUrl).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('login sets token and gatewayUrl', () => {
    useAuthStore.getState().login('1234', 'http://gateway.test:18765');
    const state = useAuthStore.getState();
    expect(state.token).toBe('1234');
    expect(state.gatewayUrl).toBe('http://gateway.test:18765');
    expect(state.isAuthenticated()).toBe(true);
  });

  it('logout clears state', () => {
    useAuthStore.getState().login('1234', 'http://gateway.test:18765');
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.gatewayUrl).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it('persists to localStorage on login', () => {
    useAuthStore.getState().login('5678', 'http://example.test:18765');
    const stored = window.localStorage.getItem('zenterm-auth');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).state.token).toBe('5678');
  });
});
