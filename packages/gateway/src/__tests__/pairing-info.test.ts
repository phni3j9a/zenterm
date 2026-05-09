import { describe, expect, it } from 'vitest';
import { formatPairingInfo } from '../pairing-info.js';

describe('formatPairingInfo', () => {
  it('includes LAN, Tailscale, Web URLs and Token', () => {
    const lines = formatPairingInfo({
      lan: '10.0.0.5',
      tailscale: '100.10.20.30',
      port: 18765,
      token: '1234',
    });
    expect(lines).toContain('  LAN:       http://10.0.0.5:18765');
    expect(lines).toContain('  Web (LAN): http://10.0.0.5:18765/web');
    expect(lines).toContain('  Tailscale: http://100.10.20.30:18765');
    expect(lines).toContain('  Web (Ts):  http://100.10.20.30:18765/web');
    expect(lines).toContain('  Token:     1234');
  });

  it('omits Tailscale lines when tailscale missing', () => {
    const lines = formatPairingInfo({
      lan: '10.0.0.5',
      tailscale: null,
      port: 18765,
      token: '1234',
    });
    expect(lines.some((l) => l.includes('Tailscale'))).toBe(false);
    expect(lines.some((l) => l.includes('Web (Ts)'))).toBe(false);
  });

  it('omits LAN lines when lan missing', () => {
    const lines = formatPairingInfo({
      lan: null,
      tailscale: '100.10.20.30',
      port: 18765,
      token: '1234',
    });
    expect(lines.some((l) => l.includes('  LAN:'))).toBe(false);
    expect(lines.some((l) => l.includes('Web (LAN)'))).toBe(false);
  });
});
