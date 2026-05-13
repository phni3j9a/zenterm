import { describe, it, expect } from 'vitest';
import { buildCommandPaletteActions } from '../commandPaletteActions';

describe('buildCommandPaletteActions', () => {
  // NOTE: each session uses displayName as identifier; no `id` field exists.
  const sessions = [
    { displayName: 'work', name: 'zen_work', created: 0, cwd: '/', windows: [
      { index: 0, name: 'editor', active: true, zoomed: false, paneCount: 1, cwd: '/' },
      { index: 1, name: 'shell', active: false, zoomed: false, paneCount: 1, cwd: '/' },
    ] },
    { displayName: 'play', name: 'zen_play', created: 0, cwd: '/', windows: [
      { index: 0, name: '0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
    ] },
  ];

  function build() {
    return buildCommandPaletteActions({
      sessions,
      navigate: () => undefined,
      paneActions: { setLayout: () => undefined },
      settingsActions: { setThemeMode: () => undefined },
      sessionsActions: { createSession: () => undefined },
    });
  }

  it('includes static actions: create session / layouts / theme / settings / files / sessions', () => {
    const ids = build().map((a) => a.id);
    expect(ids).toContain('action:create-session');
    expect(ids).toContain('action:layout:single');
    expect(ids).toContain('action:layout:cols-2');
    expect(ids).toContain('action:layout:cols-3');
    expect(ids).toContain('action:layout:grid-2x2');
    expect(ids).not.toContain('action:layout:main-side-2');
    expect(ids).toContain('action:theme:light');
    expect(ids).toContain('action:theme:dark');
    expect(ids).toContain('action:theme:system');
    expect(ids).toContain('action:nav:settings');
    expect(ids).toContain('action:nav:files');
    expect(ids).toContain('action:nav:sessions');
  });

  it('includes one entry per session window', () => {
    const sessionEntries = build().filter((a) => a.id.startsWith('jump:'));
    expect(sessionEntries).toHaveLength(3);
    expect(sessionEntries.map((a) => a.label).sort()).toEqual([
      'Open work / editor',
      'Open work / shell',
      'Open play / 0',
    ].sort());
  });
});
