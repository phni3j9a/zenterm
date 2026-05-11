export interface ParsedSessionRoute {
  sessionId: string;
  windowIndex: number;
}

const SESSION_ONLY_RE = /^\/web\/sessions\/([^/]+)\/?$/;
const SESSION_WINDOW_RE = /^\/web\/sessions\/([^/]+)\/window\/(-?\d+)\/?$/;

export function parseSessionRoute(pathname: string): ParsedSessionRoute | null {
  const wm = SESSION_WINDOW_RE.exec(pathname);
  if (wm) {
    const idx = Number.parseInt(wm[2], 10);
    if (!Number.isFinite(idx)) return null;
    return {
      sessionId: decodeURIComponent(wm[1]),
      windowIndex: Math.max(0, idx),
    };
  }
  const sm = SESSION_ONLY_RE.exec(pathname);
  if (sm) {
    return { sessionId: decodeURIComponent(sm[1]), windowIndex: 0 };
  }
  return null;
}
