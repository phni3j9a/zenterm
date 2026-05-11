import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type LayoutMode,
  SLOT_COUNT,
  SPLITTER_COUNT,
  DEFAULT_RATIOS,
  clampRatio,
  dropExtraPanes,
} from '@/lib/paneLayout';

export interface PaneTarget {
  sessionId: string;
  windowIndex: number;
}

interface PaneState {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
  ratios: Record<LayoutMode, number[]>;
  savedLayout: LayoutMode | null;

  setLayout: (mode: LayoutMode) => void;
  setFocusedIndex: (idx: number) => void;
  assignPane: (idx: number, target: PaneTarget | null) => void;
  openInFocusedPane: (target: PaneTarget) => void;
  setRatio: (mode: LayoutMode, splitterIdx: number, value: number) => void;
  isOccupied: (target: PaneTarget, excludeIdx?: number) => boolean;
  suspendForSingle: () => void;
  resume: () => void;
}

function defaultRatiosClone(): Record<LayoutMode, number[]> {
  return {
    single: [...DEFAULT_RATIOS.single],
    'cols-2': [...DEFAULT_RATIOS['cols-2']],
    'cols-3': [...DEFAULT_RATIOS['cols-3']],
    'grid-2x2': [...DEFAULT_RATIOS['grid-2x2']],
    'main-side-2': [...DEFAULT_RATIOS['main-side-2']],
  };
}

interface PersistedV1 {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
  ratios: Record<LayoutMode, number[]>;
  savedLayout: LayoutMode | null;
}

export const usePaneStore = create<PaneState>()(
  persist(
    (set, get) => ({
      layout: 'single',
      panes: [null],
      focusedIndex: 0,
      ratios: defaultRatiosClone(),
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

      setRatio: (mode, splitterIdx, value) => {
        if (splitterIdx < 0 || splitterIdx >= SPLITTER_COUNT[mode]) return;
        const { ratios } = get();
        const nextForMode = ratios[mode].slice();
        nextForMode[splitterIdx] = clampRatio(value);
        set({ ratios: { ...ratios, [mode]: nextForMode } });
      },

      isOccupied: (target, excludeIdx) => {
        const { panes } = get();
        return panes.some(
          (p, i) =>
            p !== null &&
            i !== excludeIdx &&
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
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        layout: s.layout,
        panes: s.panes,
        focusedIndex: s.focusedIndex,
        ratios: s.ratios,
        savedLayout: s.savedLayout,
      }),
      migrate: (persisted, _version): PersistedV1 => {
        const s = (persisted ?? {}) as Partial<PersistedV1>;
        return {
          layout: s.layout ?? 'single',
          panes: Array.isArray(s.panes) ? s.panes : [null],
          focusedIndex: typeof s.focusedIndex === 'number' ? s.focusedIndex : 0,
          ratios: s.ratios ?? defaultRatiosClone(),
          savedLayout: s.savedLayout ?? null,
        };
      },
    },
  ),
);
