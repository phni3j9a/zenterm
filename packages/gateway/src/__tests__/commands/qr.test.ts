import { describe, expect, it, vi, beforeEach } from 'vitest';

const networkInterfacesMock = vi.hoisted(() => vi.fn());
const qrGenerateMock = vi.hoisted(() => vi.fn((text: string, _opts: unknown, cb: (s: string) => void) => cb(`QR(${text})`)));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, networkInterfaces: networkInterfacesMock };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(() => 'AUTH_TOKEN=4321\nPORT=18765\n'),
    existsSync: vi.fn(() => true),
  };
});

vi.mock('qrcode-terminal', () => ({
  default: { generate: qrGenerateMock },
}));

describe('runQrCommand', () => {
  beforeEach(() => {
    qrGenerateMock.mockClear();
    networkInterfacesMock.mockReturnValue({
      en0: [{ family: 'IPv4', address: '10.0.0.5', internal: false }],
    });
  });

  it('generates QR for zenterm:// URL with LAN address and token', async () => {
    const logs: string[] = [];
    const { runQrCommand } = await import('../../commands/qr.js');
    await runQrCommand({ log: (m) => logs.push(String(m ?? '')) });
    const joined = logs.join('\n');
    expect(qrGenerateMock).toHaveBeenCalled();
    const qrInput = qrGenerateMock.mock.calls[0][0] as string;
    expect(qrInput).toContain('zenterm://connect');
    expect(qrInput).toContain(encodeURIComponent('http://10.0.0.5:18765'));
    expect(qrInput).toContain('token=4321');
    expect(joined).toContain('QR(zenterm://');
  });
});
