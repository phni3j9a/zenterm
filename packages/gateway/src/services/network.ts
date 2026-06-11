import os from 'node:os';

export interface NetworkAddresses {
  lan: string | null;
  tailscale: string | null;
}

export function getNetworkAddresses(): NetworkAddresses {
  const interfaces = os.networkInterfaces();
  const result: NetworkAddresses = { lan: null, tailscale: null };

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;

    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;

      // Tailscale uses 100.64.0.0/10 (CGNAT range)
      if (name.startsWith('tailscale') || entry.address.startsWith('100.')) {
        result.tailscale ??= entry.address;
      } else {
        result.lan ??= entry.address;
      }
    }
  }

  return result;
}
