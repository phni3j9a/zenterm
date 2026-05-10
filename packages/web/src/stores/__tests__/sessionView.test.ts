import { describe, expect, it, beforeEach } from 'vitest';
import { useSessionViewStore } from '../sessionView';

describe('useSessionViewStore', () => {
  beforeEach(() => {
    useSessionViewStore.setState({ activeSessionId: null, activeWindowIndex: null });
  });

  it('open with default windowIndex', () => {
    useSessionViewStore.getState().open('dev');
    const state = useSessionViewStore.getState();
    expect(state.activeSessionId).toBe('dev');
    expect(state.activeWindowIndex).toBeNull();
  });

  it('open with specified windowIndex', () => {
    useSessionViewStore.getState().open('dev', 2);
    const state = useSessionViewStore.getState();
    expect(state.activeSessionId).toBe('dev');
    expect(state.activeWindowIndex).toBe(2);
  });

  it('close clears state', () => {
    useSessionViewStore.getState().open('dev', 0);
    useSessionViewStore.getState().close();
    const state = useSessionViewStore.getState();
    expect(state.activeSessionId).toBeNull();
    expect(state.activeWindowIndex).toBeNull();
  });

  it('setWindow updates only windowIndex', () => {
    useSessionViewStore.getState().open('dev', 0);
    useSessionViewStore.getState().setWindow(3);
    expect(useSessionViewStore.getState().activeSessionId).toBe('dev');
    expect(useSessionViewStore.getState().activeWindowIndex).toBe(3);
  });
});
