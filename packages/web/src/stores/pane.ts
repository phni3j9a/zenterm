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
  savedLayout: LayoutMode | null;

  setLayout: (mode: LayoutMode) => void;
  setFocusedIndex: (idx: number) => void;
  assignPane: (idx: number, target: PaneTarget | null) => void;
  openInFocusedPane: (target: PaneTarget) => void;
  isOccupied: (target: PaneTarget, excludeIdx?: number) => boolean;
  suspendForSingle: () => void;
  resume: () => void;
}

interface PersistedV2 {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
  savedLayout: LayoutMode | null;
}

function isLayoutMode(value: unknown): value is LayoutMode {
  return (
    typeof value === 'string' &&
    (LAYOUT_MODES as readonly string[]).includes(value)
  );
}

export const usePaneStore = create<PaneState>()(
  persist(
    (set, get) => ({
      layout: 'single',
      panes: [null],
      focusedIndex: 0,
      savedLayout: null,

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

      suspendForSingle: () => {
        const { layout } = get();
        if (layout === 'single') return;
        set({ savedLayout: layout });
        get().setLayout('single');
      },

      resume: () => {
        const { savedLayout } = get();
        if (!savedLayout) return;
        get().setLayout(savedLayout);
        set({ savedLayout: null });
      },
    }),
    {
      name: 'zenterm-web-pane',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        layout: s.layout,
        panes: s.panes,
        focusedIndex: s.focusedIndex,
        savedLayout: s.savedLayout,
      }),
      migrate: (persisted, _version): PersistedV2 => {
        const s = (persisted ?? {}) as Partial<PersistedV2> & {
          // v1 fields (dropped in v2): ratios
          ratios?: unknown;
        };
        const layout = isLayoutMode(s.layout) ? s.layout : 'single';
        const savedLayout = isLayoutMode(s.savedLayout) ? s.savedLayout : null;
        const panes = Array.isArray(s.panes) ? s.panes : [null];
        const focusedIndex =
          typeof s.focusedIndex === 'number' ? s.focusedIndex : 0;
        return { layout, panes, focusedIndex, savedLayout };
      },
    },
  ),
);
