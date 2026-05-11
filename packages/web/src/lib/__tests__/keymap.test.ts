import { describe, it, expect, vi, afterEach } from 'vitest';
import { matchShortcut, type ShortcutSpec } from '../keymap';

afterEach(() => {
  vi.unstubAllGlobals();
});

function ev(init: Partial<KeyboardEvent>): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('matchShortcut', () => {
  it('matches ⌘K on mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    const spec: ShortcutSpec = { key: 'k', mod: true };
    expect(matchShortcut(ev({ key: 'k', metaKey: true }), spec)).toBe(true);
    expect(matchShortcut(ev({ key: 'k', ctrlKey: true }), spec)).toBe(false);
  });

  it('matches Ctrl+K on non-mac', () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'Linux' });
    const spec: ShortcutSpec = { key: 'k', mod: true };
    expect(matchShortcut(ev({ key: 'k', ctrlKey: true }), spec)).toBe(true);
    expect(matchShortcut(ev({ key: 'k', metaKey: true }), spec)).toBe(false);
  });

  it('matches digits and is case-insensitive on letters', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(matchShortcut(ev({ key: '3', metaKey: true }), { key: '3', mod: true })).toBe(true);
    expect(matchShortcut(ev({ key: 'F', metaKey: true }), { key: 'f', mod: true })).toBe(true);
  });

  it('rejects when shift required but absent', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    const spec: ShortcutSpec = { key: 'p', mod: true, shift: true };
    expect(matchShortcut(ev({ key: 'p', metaKey: true }), spec)).toBe(false);
    expect(matchShortcut(ev({ key: 'p', metaKey: true, shiftKey: true }), spec)).toBe(true);
  });

  it('rejects extra modifiers when not requested', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    const spec: ShortcutSpec = { key: 'k', mod: true };
    expect(matchShortcut(ev({ key: 'k', metaKey: true, altKey: true }), spec)).toBe(false);
  });
});
