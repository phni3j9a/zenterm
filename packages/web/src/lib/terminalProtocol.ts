import type { ClientMessage, ServerMessage } from '@zenterm/shared';

export function encodeInput(data: string): string {
  const msg: ClientMessage = { type: 'input', data };
  return JSON.stringify(msg);
}

export function encodeResize(cols: number, rows: number): string {
  const msg: ClientMessage = { type: 'resize', cols, rows };
  return JSON.stringify(msg);
}

export function encodeSignal(signal: string): string {
  const msg: ClientMessage = { type: 'signal', signal };
  return JSON.stringify(msg);
}

const VALID_SERVER_TYPES = new Set(['output', 'sessionInfo', 'exit', 'error']);

export function parseServerMessage(raw: string): ServerMessage | null {
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
    typeof (parsed as { type: unknown }).type !== 'string' ||
    !VALID_SERVER_TYPES.has((parsed as { type: string }).type)
  ) {
    return null;
  }
  return parsed as ServerMessage;
}

export function buildTerminalWsUrl(
  gatewayUrl: string,
  sessionId: string,
  windowIndex: number,
  token: string,
): string {
  const wsUrl = gatewayUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams({
    sessionId,
    windowIndex: String(windowIndex),
    token,
  });
  return `${wsUrl}/ws/terminal?${params.toString()}`;
}
