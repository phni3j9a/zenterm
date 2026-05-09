import { createRequire } from 'node:module';
import os from 'node:os';
import { config } from './config.js';
import { buildApp } from './app.js';
import { cleanupOrphanViewSessions } from './services/tmux.js';

const require = createRequire(import.meta.url);

const app = await buildApp();

// 前回終了時に取り残された一時的な view session を一掃しておく。
cleanupOrphanViewSessions();
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ signal }, 'shutting down gateway');

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error, signal }, 'failed to shut down cleanly');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

interface NetworkAddresses {
  lan: string | null;
  tailscale: string | null;
}

function getNetworkAddresses(): NetworkAddresses {
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

export interface PairingInfoInput {
  lan: string | null;
  tailscale: string | null;
  port: number;
  token: string;
}

export function formatPairingInfo(input: PairingInfoInput): string[] {
  const { lan, tailscale, port, token } = input;
  const lines: string[] = [];
  if (lan) {
    lines.push(`  LAN:       http://${lan}:${port}`);
    lines.push(`  Web (LAN): http://${lan}:${port}/web`);
  }
  if (tailscale) {
    lines.push(`  Tailscale: http://${tailscale}:${port}`);
    lines.push(`  Web (Ts):  http://${tailscale}:${port}/web`);
  }
  lines.push(`  Token:     ${token}`);
  return lines;
}

function showPairingInfo(): void {
  const { lan, tailscale } = getNetworkAddresses();

  if (!lan && !tailscale) {
    app.log.warn('ネットワークアドレスを検出できませんでした。');
    return;
  }

  const primaryIp = lan ?? tailscale!;
  const primaryUrl = `http://${primaryIp}:${config.PORT}`;
  const pairingUrl = `zenterm://connect?url=${encodeURIComponent(primaryUrl)}&token=${encodeURIComponent(config.AUTH_TOKEN)}`;

  console.log('');
  console.log('--- zenterm gateway ---');
  for (const line of formatPairingInfo({
    lan,
    tailscale,
    port: config.PORT,
    token: config.AUTH_TOKEN,
  })) {
    console.log(line);
  }
  console.log('');

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const qr = require('qrcode-terminal') as { generate: (text: string, opts: { small: boolean }, cb: (code: string) => void) => void };
    qr.generate(pairingUrl, { small: true }, (code: string) => {
      console.log('  QR コードをモバイルアプリでスキャンしてください:');
      console.log(code);
    });
  } catch {
    console.log(`  Pairing URL: ${pairingUrl}`);
  }

  console.log('---------------------------');
  console.log('');
}

if (process.env.NODE_ENV !== 'test') {
  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST
    });

    app.log.info({ address }, 'zenterm-gateway listening');
    showPairingInfo();
  } catch (error) {
    const isAddrInUse =
      error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EADDRINUSE';

    if (isAddrInUse) {
      console.error('');
      console.error(`⚠ ポート ${config.PORT} は既に使用中です。`);
      console.error('  zenterm-gateway が既に起動している可能性があります。');
      console.error('');
      console.error(`  確認:     ss -tlnp | grep ${config.PORT}`);
      console.error(`  別ポート: zenterm-gateway --port ${config.PORT + 1}`);
      console.error('');
    } else {
      app.log.error({ err: error }, 'failed to start gateway');
    }

    process.exit(1);
  }
}
