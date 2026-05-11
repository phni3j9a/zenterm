import { describe, expect, it } from 'vitest';
import { buildPairingUrl } from '../qr';

describe('buildPairingUrl', () => {
  it('builds zenterm:// URL with url and token query params', () => {
    const url = buildPairingUrl('http://10.0.0.1:18765', 'abcd');
    expect(url.startsWith('zenterm://connect?')).toBe(true);
    expect(url).toContain('url=http%3A%2F%2F10.0.0.1%3A18765');
    expect(url).toContain('token=abcd');
  });

  it('encodes special characters in token', () => {
    const url = buildPairingUrl('http://x', 'a&b=c');
    expect(url).toContain('token=a%26b%3Dc');
  });

  it('strips trailing slash from origin', () => {
    const url = buildPairingUrl('http://x/', 't');
    expect(url).toContain('url=http%3A%2F%2Fx');
  });
});
