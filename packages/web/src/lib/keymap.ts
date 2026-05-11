import { isMac } from './platform';

export interface ShortcutSpec {
  /** Lowercase key name (e.g. 'k', 'f', 'arrowleft', '['). */
  key: string;
  /** Cmd on mac, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

function normalizeKey(k: string): string {
  return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
}

export function matchShortcut(ev: KeyboardEvent, spec: ShortcutSpec): boolean {
  if (normalizeKey(ev.key) !== normalizeKey(spec.key)) return false;
  const mac = isMac();
  const modPressed = mac ? ev.metaKey : ev.ctrlKey;
  const wrongModPressed = mac ? ev.ctrlKey : ev.metaKey;
  if (!!spec.mod !== modPressed) return false;
  if (wrongModPressed) return false;
  if (!!spec.shift !== ev.shiftKey) return false;
  if (!!spec.alt !== ev.altKey) return false;
  return true;
}
