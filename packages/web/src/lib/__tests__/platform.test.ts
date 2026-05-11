import { describe, it, expect, afterEach, vi } from 'vitest';
import { isMac, modifierLabel } from '../platform';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform', () => {
  it('detects macOS via navigator.platform', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(isMac()).toBe(true);
    expect(modifierLabel()).toBe('⌘');
  });

  it('detects macOS via userAgent fallback', () => {
    vi.stubGlobal('navigator', { platform: '', userAgent: 'Mozilla/5.0 (Macintosh)' });
    expect(isMac()).toBe(true);
  });

  it('returns Ctrl on other platforms', () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'Linux' });
    expect(isMac()).toBe(false);
    expect(modifierLabel()).toBe('Ctrl');
  });
});
