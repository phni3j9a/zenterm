import { describe, expect, it } from 'vitest';
import { parseSessionRoute, buildSessionPath } from '../urlSync';

describe('parseSessionRoute', () => {
  it('returns null for non-matching pathname', () => {
    expect(parseSessionRoute('/web/settings')).toBeNull();
    expect(parseSessionRoute('/web/files')).toBeNull();
    expect(parseSessionRoute('/web/sessions')).toBeNull();
    expect(parseSessionRoute('/web/login')).toBeNull();
  });

  it('parses /web/sessions/:id with default windowIndex 0', () => {
    expect(parseSessionRoute('/web/sessions/work')).toEqual({
      sessionId: 'work',
      windowIndex: 0,
    });
  });

  it('parses /web/sessions/:id/window/:index with explicit window index', () => {
    expect(parseSessionRoute('/web/sessions/work/window/2')).toEqual({
      sessionId: 'work',
      windowIndex: 2,
    });
  });

  it('clamps negative window index to 0', () => {
    expect(parseSessionRoute('/web/sessions/work/window/-1')).toEqual({
      sessionId: 'work',
      windowIndex: 0,
    });
  });

  it('returns null for non-numeric window index', () => {
    expect(parseSessionRoute('/web/sessions/work/window/abc')).toBeNull();
  });

  it('decodes percent-encoded session id', () => {
    expect(parseSessionRoute('/web/sessions/my%20work')).toEqual({
      sessionId: 'my work',
      windowIndex: 0,
    });
  });

  it('returns null when session id has malformed percent-encoding', () => {
    expect(parseSessionRoute('/web/sessions/%E0%A4%A')).toBeNull();
    expect(parseSessionRoute('/web/sessions/%2/window/1')).toBeNull();
  });
});

describe('buildSessionPath', () => {
  it('builds /web/sessions/<id> when windowIndex is 0', () => {
    expect(buildSessionPath('work', 0)).toBe('/web/sessions/work');
  });
  it('builds /web/sessions/<id>/window/<idx> when windowIndex > 0', () => {
    expect(buildSessionPath('work', 2)).toBe('/web/sessions/work/window/2');
  });
  it('encodes special chars in sessionId', () => {
    expect(buildSessionPath('my session/1', 0)).toBe('/web/sessions/my%20session%2F1');
  });
  it('treats negative windowIndex as 0', () => {
    expect(buildSessionPath('work', -1)).toBe('/web/sessions/work');
  });
});
