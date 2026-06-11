import { afterEach, describe, expect, it, vi } from 'vitest';

const networkInterfacesMock = vi.hoisted(() => vi.fn());

vi.mock('node:os', () => ({
  default: { networkInterfaces: networkInterfacesMock },
}));

import { getNetworkAddresses } from '../../services/network.js';

describe('getNetworkAddresses', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('LANとTailscaleのIPv4を分類する', () => {
    networkInterfacesMock.mockReturnValue({
      eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.10' }],
      tailscale0: [{ family: 'IPv4', internal: false, address: '100.90.1.2' }],
    });
    expect(getNetworkAddresses()).toEqual({ lan: '192.168.1.10', tailscale: '100.90.1.2' });
  });

  it('インターフェース名がtailscaleでなくても100.x.x.xはTailscale扱い', () => {
    networkInterfacesMock.mockReturnValue({
      utun3: [{ family: 'IPv4', internal: false, address: '100.64.0.5' }],
    });
    expect(getNetworkAddresses()).toEqual({ lan: null, tailscale: '100.64.0.5' });
  });

  it('internal・IPv6は無視し、何もなければ両方null', () => {
    networkInterfacesMock.mockReturnValue({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      eth0: [{ family: 'IPv6', internal: false, address: 'fe80::1' }],
    });
    expect(getNetworkAddresses()).toEqual({ lan: null, tailscale: null });
  });
});
