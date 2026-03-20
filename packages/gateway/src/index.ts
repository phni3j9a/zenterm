import { createRequire } from 'node:module';
import os from 'node:os';
import { config } from './config.js';
import { buildApp } from './app.js';

const require = createRequire(import.meta.url);

const app = await buildApp();
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

function getLanIp(): string | null {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return null;
}

function showPairingInfo(): void {
  const lanIp = getLanIp();

  if (!lanIp) {
    app.log.warn('LAN IP を検出できませんでした。');
    return;
  }

  const url = `http://${lanIp}:${config.PORT}`;
  const pairingUrl = `palmsh://connect?url=${encodeURIComponent(url)}&token=${encodeURIComponent(config.AUTH_TOKEN)}`;

  console.log('');
  console.log('--- palmsh gateway ---');
  console.log(`  Web:   ${url}`);
  console.log(`  Token: ${config.AUTH_TOKEN}`);
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

try {
  const address = await app.listen({
    port: config.PORT,
    host: config.HOST
  });

  app.log.info({ address }, 'palmsh-gateway listening');
  showPairingInfo();
} catch (error) {
  app.log.error({ err: error }, 'failed to start gateway');
  process.exit(1);
}
