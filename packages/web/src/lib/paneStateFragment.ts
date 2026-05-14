import { LAYOUT_MODES, SLOT_COUNT, type LayoutMode } from './paneLayout';
import type { PaneTarget } from '@/stores/pane';

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

function encodePane(p: PaneTarget | null): string {
  if (p === null) return EMPTY_SLOT;
  if (p.kind === 'terminal') {
    return `t:${encodeURIComponent(p.sessionId)}.${p.windowIndex}`;
  }
  return `f:${encodeURIComponent(p.path)}`;
}

function decodePane(slot: string): PaneTarget | null | 'invalid' {
  if (slot === EMPTY_SLOT) return null;
  if (slot.startsWith('t:')) {
    const body = slot.slice(2);
    const dotIdx = body.lastIndexOf('.');
    if (dotIdx < 0) return 'invalid';
    const sidPart = body.slice(0, dotIdx);
    const idxPart = body.slice(dotIdx + 1);
    const idx = Number.parseInt(idxPart, 10);
    if (!Number.isFinite(idx) || idx < 0 || String(idx) !== idxPart) return 'invalid';
    const sid = safeDecode(sidPart);
    if (sid === null) return 'invalid';
    return { kind: 'terminal', sessionId: sid, windowIndex: idx };
  }
  if (slot.startsWith('f:')) {
    const path = safeDecode(slot.slice(2));
    if (path === null) return 'invalid';
    return { kind: 'file', path };
  }
  // Legacy: <sid>.<idx>
  // 新 prefix (`t:` / `f:` / 未知 `x:`) との混同を避けるため、
  // raw `:` を含むものは invalid 扱いにする。
  // legacy 形式の sid は encodeURIComponent 済みで `:` は `%3A` になるため、
  // 生の `:` を含むのは新 prefix 形式のみ。
  if (slot.includes(':')) return 'invalid';
  const dotIdx = slot.lastIndexOf('.');
  if (dotIdx < 0) return 'invalid';
  const sidPart = slot.slice(0, dotIdx);
  const idxPart = slot.slice(dotIdx + 1);
  const idx = Number.parseInt(idxPart, 10);
  if (!Number.isFinite(idx) || idx < 0 || String(idx) !== idxPart) return 'invalid';
  const sid = safeDecode(sidPart);
  if (sid === null) return 'invalid';
  return { kind: 'terminal', sessionId: sid, windowIndex: idx };
}

export function encode(state: PaneFragmentState): string {
  return `l=${state.layout}&p=${state.panes.map(encodePane).join(',')}`;
}

export function decode(hash: string): PaneFragmentState | null {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  // 注意: URLSearchParams.get は値中の `%2C` を `,` にデコードしてしまい
  // 後段の `,` split を壊す。slot 内のエンコードは decodePane が担うため、
  // ここでは raw に `&` / `=` でパースして slot 列を維持する。
  let l: string | null = null;
  let p: string | null = null;
  for (const part of trimmed.split('&')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx < 0) continue;
    const key = part.slice(0, eqIdx);
    const val = part.slice(eqIdx + 1);
    if (key === 'l') l = val;
    else if (key === 'p') p = val;
  }
  if (!l || !p) return null;
  if (!(LAYOUT_MODES as readonly string[]).includes(l)) return null;
  const layout = l as LayoutMode;
  const expectedCount = SLOT_COUNT[layout];
  const slots = p.split(',');
  if (slots.length !== expectedCount) return null;
  const panes: (PaneTarget | null)[] = [];
  for (const slot of slots) {
    const parsed = decodePane(slot);
    if (parsed === 'invalid') return null;
    panes.push(parsed);
  }
  return { layout, panes };
}
