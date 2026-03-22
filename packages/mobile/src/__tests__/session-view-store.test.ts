/// <reference types="jest" />

import { act } from 'react-test-renderer';

import { useSessionViewStore } from '../stores/sessionView';

describe('useSessionViewStore', () => {
  beforeEach(() => {
    useSessionViewStore.setState({ activeSessionId: null });
  });

  it('初期状態では activeSessionId が null', () => {
    expect(useSessionViewStore.getState().activeSessionId).toBeNull();
  });

  it('open で activeSessionId を更新できる', () => {
    act(() => {
      useSessionViewStore.getState().open('work');
    });

    expect(useSessionViewStore.getState().activeSessionId).toBe('work');
  });

  it('close で activeSessionId をクリアできる', () => {
    act(() => {
      useSessionViewStore.getState().open('work');
      useSessionViewStore.getState().close();
    });

    expect(useSessionViewStore.getState().activeSessionId).toBeNull();
  });
});
