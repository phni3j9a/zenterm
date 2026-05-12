export interface ParsedSessionRoute {
  sessionId: string;
  windowIndex: number;
}

const SESSION_ONLY_RE = /^\/web\/sessions\/([^/]+)\/?$/;
const SESSION_WINDOW_RE = /^\/web\/sessions\/([^/]+)\/window\/(-?\d+)\/?$/;

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function buildSessionPath(sessionId: string, windowIndex: number): string {
  const sid = encodeURIComponent(sessionId);
  if (windowIndex <= 0) return `/web/sessions/${sid}`;
  return `/web/sessions/${sid}/window/${windowIndex}`;
}

export function parseSessionRoute(pathname: string): ParsedSessionRoute | null {
  const wm = SESSION_WINDOW_RE.exec(pathname);
  if (wm) {
    const idx = Number.parseInt(wm[2], 10);
    if (!Number.isFinite(idx)) return null;
    const sid = safeDecode(wm[1]);
    if (sid === null) return null;
    return { sessionId: sid, windowIndex: Math.max(0, idx) };
  }
  const sm = SESSION_ONLY_RE.exec(pathname);
  if (sm) {
    const sid = safeDecode(sm[1]);
    if (sid === null) return null;
    return { sessionId: sid, windowIndex: 0 };
  }
  return null;
}
