import type { TmuxEvent } from '@zenterm/shared';

const VALID_TYPES = new Set<TmuxEvent['type']>([
  'sessions-changed',
  'windows-changed',
  'monitor-restart',
]);

export function parseEvent(raw: string): TmuxEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    typeof (parsed as { type: unknown }).type !== 'string'
  ) {
    return null;
  }
  const type = (parsed as { type: string }).type as TmuxEvent['type'];
  if (!VALID_TYPES.has(type)) return null;
  return { type };
}
