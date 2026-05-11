import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionViewStore } from '../sessionView';
import { usePaneStore } from '../pane';

beforeEach(() => {
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    ratios: {
      single: [],
      'cols-2': [0.5],
      'cols-3': [1 / 3, 0.5],
      'grid-2x2': [0.5, 0.5],
      'main-side-2': [0.6, 0.5],
    },
    savedLayout: null,
  });
});

describe('sessionView (paneStore wrapper)', () => {
  it('open(sessionId, windowIndex) で paneStore.openInFocusedPane が呼ばれる', () => {
    useSessionViewStore.getState().open('dev', 2);
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'dev', windowIndex: 2 });
  });

  it('open(sessionId) で windowIndex は null', () => {
    useSessionViewStore.getState().open('dev');
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'dev', windowIndex: null });
  });

  it('activeSessionId / activeWindowIndex は focused pane の派生', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 1 });
    const s = useSessionViewStore.getState();
    expect(s.activeSessionId).toBe('a');
    expect(s.activeWindowIndex).toBe(1);
  });

  it('close() で focused pane を null にする', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    useSessionViewStore.getState().close();
    expect(usePaneStore.getState().panes[0]).toBe(null);
  });

  it('setWindow(idx) は focused pane の windowIndex のみ更新', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    useSessionViewStore.getState().setWindow(3);
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'a', windowIndex: 3 });
  });

  it('focused pane が null のとき setWindow は no-op', () => {
    useSessionViewStore.getState().setWindow(3);
    expect(usePaneStore.getState().panes[0]).toBe(null);
  });
});
