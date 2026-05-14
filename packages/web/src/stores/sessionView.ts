import { useSyncExternalStore } from 'react';
import { usePaneStore } from './pane';

interface SessionViewSnapshot {
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  open: (sessionId: string, windowIndex?: number) => void;
  close: () => void;
  setWindow: (windowIndex: number) => void;
}

// Stable action handlers (do not depend on snapshot identity).
const open: SessionViewSnapshot['open'] = (sessionId, windowIndex) => {
  usePaneStore.getState().openInFocusedPane({
    kind: 'terminal',
    sessionId,
    windowIndex: (windowIndex ?? null) as number,
  });
};

const close: SessionViewSnapshot['close'] = () => {
  const { focusedIndex: idx } = usePaneStore.getState();
  usePaneStore.getState().assignPane(idx, null);
};

const setWindow: SessionViewSnapshot['setWindow'] = (windowIndex) => {
  const { panes: ps, focusedIndex: idx } = usePaneStore.getState();
  const current = ps[idx];
  if (!current || current.kind !== 'terminal') return;
  usePaneStore.getState().assignPane(idx, {
    kind: 'terminal',
    sessionId: current.sessionId,
    windowIndex,
  });
};

// Cached snapshot so `useSyncExternalStore` sees a stable reference until the
// underlying focused-pane slice actually changes. Returning a fresh object on
// every call causes React to bail out with "getSnapshot should be cached".
let cachedSnapshot: SessionViewSnapshot | null = null;
let cachedSessionId: string | null = null;
let cachedWindowIndex: number | null = null;

function getSnapshot(): SessionViewSnapshot {
  const { panes, focusedIndex } = usePaneStore.getState();
  const focused = panes[focusedIndex] ?? null;
  const sid = focused && focused.kind === 'terminal' ? focused.sessionId : null;
  const widx = focused && focused.kind === 'terminal' ? focused.windowIndex : null;
  if (
    cachedSnapshot !== null &&
    cachedSessionId === sid &&
    cachedWindowIndex === widx
  ) {
    return cachedSnapshot;
  }
  cachedSessionId = sid;
  cachedWindowIndex = widx;
  cachedSnapshot = {
    activeSessionId: sid,
    activeWindowIndex: widx,
    open,
    close,
    setWindow,
  };
  return cachedSnapshot;
}

export const useSessionViewStore = Object.assign(
  function useSessionViewStoreHook<T>(selector: (s: SessionViewSnapshot) => T): T {
    return useSyncExternalStore(
      (cb) => usePaneStore.subscribe(cb),
      () => selector(getSnapshot()),
      () => selector(getSnapshot()),
    );
  },
  {
    getState: getSnapshot,
    setState: (
      partial:
        | Partial<Pick<SessionViewSnapshot, 'activeSessionId' | 'activeWindowIndex'>>
        | ((s: SessionViewSnapshot) => Partial<SessionViewSnapshot>),
    ) => {
      const next = typeof partial === 'function' ? partial(getSnapshot()) : partial;
      const sid = 'activeSessionId' in next ? next.activeSessionId ?? null : getSnapshot().activeSessionId;
      const widx =
        'activeWindowIndex' in next ? next.activeWindowIndex ?? null : getSnapshot().activeWindowIndex;
      const { focusedIndex: idx } = usePaneStore.getState();
      if (sid === null) {
        usePaneStore.getState().assignPane(idx, null);
      } else {
        usePaneStore.getState().assignPane(idx, {
          kind: 'terminal',
          sessionId: sid,
          windowIndex: widx as number,
        });
      }
    },
  },
);
