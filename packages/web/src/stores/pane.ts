import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type LayoutMode,
  LAYOUT_MODES,
  SLOT_COUNT,
  dropExtraPanes,
} from '@/lib/paneLayout';

export type PaneTarget =
  | { kind: 'terminal'; sessionId: string; windowIndex: number }
  | { kind: 'file'; path: string };

interface PaneState {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;

  setLayout: (mode: LayoutMode) => void;
  setFocusedIndex: (idx: number) => void;
  assignPane: (idx: number, target: PaneTarget | null) => void;
  openInFocusedPane: (target: PaneTarget) => void;
  isOccupied: (target: PaneTarget, excludeIdx?: number) => boolean;
}

interface PersistedV3 {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
}

function isLayoutMode(value: unknown): value is LayoutMode {
  return (
    typeof value === 'string' &&
    (LAYOUT_MODES as readonly string[]).includes(value)
  );
}

export function migratePaneStoreV2ToV3(persisted: unknown): PersistedV3 {
  const s = (persisted ?? {}) as {
    layout?: unknown;
    panes?: unknown;
    focusedIndex?: unknown;
  };
  const layout = isLayoutMode(s.layout) ? s.layout : 'single';
  const focusedIndex = typeof s.focusedIndex === 'number' ? s.focusedIndex : 0;
  const rawPanes = Array.isArray(s.panes) ? s.panes : [null];
  const panes: (PaneTarget | null)[] = rawPanes.map((p) => {
    if (p === null || typeof p !== 'object') return null;
    const cand = p as { sessionId?: unknown; windowIndex?: unknown };
    if (
      typeof cand.sessionId === 'string' &&
      typeof cand.windowIndex === 'number'
    ) {
      return {
        kind: 'terminal',
        sessionId: cand.sessionId,
        windowIndex: cand.windowIndex,
      };
    }
    return null;
  });
  return { layout, panes, focusedIndex };
}

export const usePaneStore = create<PaneState>()(
  persist(
    (set, get) => ({
      layout: 'single',
      panes: [null],
      focusedIndex: 0,

      setLayout: (mode) => {
        const { panes, focusedIndex } = get();
        if (panes.length === SLOT_COUNT[mode]) {
          set({ layout: mode });
          return;
        }
        const { panes: nextPanes, focusedIndex: nextFocus } = dropExtraPanes(
          panes,
          focusedIndex,
          SLOT_COUNT[mode],
        );
        set({ layout: mode, panes: nextPanes, focusedIndex: nextFocus });
      },

      setFocusedIndex: (idx) => {
        const { panes } = get();
        if (idx < 0 || idx >= panes.length) return;
        set({ focusedIndex: idx });
      },

      assignPane: (idx, target) => {
        const { panes } = get();
        if (idx < 0 || idx >= panes.length) return;
        const next = panes.slice();
        next[idx] = target;
        set({ panes: next });
      },

      openInFocusedPane: (target) => {
        const { focusedIndex } = get();
        get().assignPane(focusedIndex, target);
      },

      isOccupied: (target, excludeIdx) => {
        if (target.kind !== 'terminal') return false;
        const { panes } = get();
        return panes.some(
          (p, i) =>
            p !== null &&
            i !== excludeIdx &&
            p.kind === 'terminal' &&
            p.sessionId === target.sessionId &&
            p.windowIndex === target.windowIndex,
        );
      },
    }),
    {
      name: 'zenterm-web-pane',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        layout: s.layout,
        panes: s.panes,
        focusedIndex: s.focusedIndex,
      }),
      migrate: (persisted) => migratePaneStoreV2ToV3(persisted),
    },
  ),
);
