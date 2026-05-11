import type { PaneTarget } from '@/stores/pane';

export type LayoutMode = 'single' | 'cols-2' | 'cols-3' | 'grid-2x2' | 'main-side-2';

export const LAYOUT_MODES: readonly LayoutMode[] = [
  'single',
  'cols-2',
  'cols-3',
  'grid-2x2',
  'main-side-2',
] as const;

export const SLOT_COUNT: Record<LayoutMode, number> = {
  single: 1,
  'cols-2': 2,
  'cols-3': 3,
  'grid-2x2': 4,
  'main-side-2': 3,
};

export const SPLITTER_COUNT: Record<LayoutMode, number> = {
  single: 0,
  'cols-2': 1,
  'cols-3': 2,
  'grid-2x2': 2,
  'main-side-2': 2,
};

export const DEFAULT_RATIOS: Record<LayoutMode, readonly number[]> = {
  single: [],
  'cols-2': [0.5],
  'cols-3': [1 / 3, 0.5],
  'grid-2x2': [0.5, 0.5],
  'main-side-2': [0.6, 0.5],
};

export const MIN_PANE_PX = 320;
export const RATIO_MIN = 0.1;
export const RATIO_MAX = 0.9;

export function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  if (value < RATIO_MIN) return RATIO_MIN;
  if (value > RATIO_MAX) return RATIO_MAX;
  return value;
}

export interface DropExtraResult {
  panes: (PaneTarget | null)[];
  focusedIndex: number;
}

export function dropExtraPanes(
  current: (PaneTarget | null)[],
  focusedIndex: number,
  nextCount: number,
): DropExtraResult {
  const safeCount = Math.max(0, nextCount);
  const clampedFocus =
    focusedIndex >= 0 && focusedIndex < current.length ? focusedIndex : 0;
  const focused = current[clampedFocus] ?? null;
  const rest = current.filter((_, i) => i !== clampedFocus);

  if (safeCount >= current.length) {
    const expanded: (PaneTarget | null)[] = [...current];
    while (expanded.length < safeCount) expanded.push(null);
    return {
      panes: expanded,
      focusedIndex: clampedFocus,
    };
  }

  if (safeCount === 0) {
    return { panes: [], focusedIndex: 0 };
  }

  const result: (PaneTarget | null)[] = [focused];
  for (const p of rest) {
    if (result.length >= safeCount) break;
    result.push(p);
  }
  while (result.length < safeCount) result.push(null);
  return { panes: result, focusedIndex: 0 };
}
