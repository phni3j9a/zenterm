import { LAYOUT_MODES, SLOT_COUNT, type LayoutMode } from './paneLayout';

export interface PaneTarget {
  sessionId: string;
  windowIndex: number;
}

export interface PaneFragmentState {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
}

const EMPTY_SLOT = '_';

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function encode(state: PaneFragmentState): string {
  const slots = state.panes.map((p) => {
    if (p === null) return EMPTY_SLOT;
    return `${encodeURIComponent(p.sessionId)}.${p.windowIndex}`;
  });
  return `l=${state.layout}&p=${slots.join(',')}`;
}

export function decode(hash: string): PaneFragmentState | null {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const l = params.get('l');
  const p = params.get('p');
  if (!l || !p) return null;
  if (!(LAYOUT_MODES as readonly string[]).includes(l)) return null;
  const layout = l as LayoutMode;
  const expectedCount = SLOT_COUNT[layout];
  const slots = p.split(',');
  if (slots.length !== expectedCount) return null;
  const panes: (PaneTarget | null)[] = [];
  for (const slot of slots) {
    if (slot === EMPTY_SLOT) {
      panes.push(null);
      continue;
    }
    const dotIdx = slot.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const sidPart = slot.slice(0, dotIdx);
    const idxPart = slot.slice(dotIdx + 1);
    const idx = Number.parseInt(idxPart, 10);
    if (!Number.isFinite(idx) || idx < 0 || String(idx) !== idxPart) return null;
    const sid = safeDecode(sidPart);
    if (sid === null) return null;
    panes.push({ sessionId: sid, windowIndex: idx });
  }
  return { layout, panes };
}
