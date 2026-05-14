import type { PaneTarget } from '@/stores/pane';

export type LayoutMode = 'single' | 'cols-2' | 'cols-3' | 'grid-2x2';

export type PaneDirection = 'up' | 'down' | 'left' | 'right';

export const LAYOUT_MODES: readonly LayoutMode[] = [
  'single',
  'cols-2',
  'cols-3',
  'grid-2x2',
] as const;

export const SLOT_COUNT: Record<LayoutMode, number> = {
  single: 1,
  'cols-2': 2,
  'cols-3': 3,
  'grid-2x2': 4,
};

// Returns the neighbor slot index in the given direction, or null if there's
// no neighbor (edge of the layout). grid-2x2 indices are laid out as:
//   [0 1]
//   [2 3]
export function paneNeighbor(
  layout: LayoutMode,
  fromIndex: number,
  dir: PaneDirection,
): number | null {
  const slots = SLOT_COUNT[layout];
  if (fromIndex < 0 || fromIndex >= slots) return null;
  if (layout === 'single') return null;
  if (layout === 'cols-2' || layout === 'cols-3') {
    if (dir === 'left' && fromIndex > 0) return fromIndex - 1;
    if (dir === 'right' && fromIndex < slots - 1) return fromIndex + 1;
    return null;
  }
  // grid-2x2
  if (dir === 'left' && fromIndex % 2 === 1) return fromIndex - 1;
  if (dir === 'right' && fromIndex % 2 === 0) return fromIndex + 1;
  if (dir === 'up' && fromIndex >= 2) return fromIndex - 2;
  if (dir === 'down' && fromIndex < 2) return fromIndex + 2;
  return null;
}

export interface DropExtraResult {
  panes: (PaneTarget | null)[];
  focusedIndex: number;
}

export function upgradeLayout(current: LayoutMode): LayoutMode | null {
  if (current === 'single') return 'cols-2';
  if (current === 'cols-2') return 'cols-3';
  if (current === 'cols-3') return 'grid-2x2';
  return null;
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
