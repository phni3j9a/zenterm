import { describe, expect, it, vi, beforeEach } from 'vitest';

const networkInterfacesMock = vi.hoisted(() => vi.fn());

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    networkInterfaces: networkInterfacesMock,
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(() => 'AUTH_TOKEN=9876\nPORT=18765\nHOST=0.0.0.0\n'),
    existsSync: vi.fn(() => true),
  };
});

describe('runInfoCommand', () => {
  beforeEach(() => {
    networkInterfacesMock.mockReturnValue({
      en0: [{ family: 'IPv4', address: '192.168.1.42', internal: false }],
      tailscale0: [{ family: 'IPv4', address: '100.50.60.70', internal: false }],
    });
  });

  it('prints LAN, Tailscale, Web URLs and Token from .env', async () => {
    const logs: string[] = [];
    const log = vi.fn((msg?: unknown) => {
      logs.push(String(msg ?? ''));
    });
    const { runInfoCommand } = await import('../../commands/info.js');
    await runInfoCommand({ log });
    const joined = logs.join('\n');
    expect(joined).toContain('http://192.168.1.42:18765');
    expect(joined).toContain('http://192.168.1.42:18765/web');
    expect(joined).toContain('http://100.50.60.70:18765');
    expect(joined).toContain('http://100.50.60.70:18765/web');
    expect(joined).toContain('Token:     9876');
  });
});
