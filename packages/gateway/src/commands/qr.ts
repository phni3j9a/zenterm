import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import qrcodeTerminal from 'qrcode-terminal';

interface RunQrOptions {
  log?: (message?: unknown) => void;
}

function getPrimaryAddress(): string | null {
  const interfaces = networkInterfaces();
  let lan: string | null = null;
  let tailscale: string | null = null;
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (name.startsWith('tailscale') || entry.address.startsWith('100.')) {
        tailscale ??= entry.address;
      } else {
        lan ??= entry.address;
      }
    }
  }
  return lan ?? tailscale;
}

function readEnv(): { token: string; port: number } {
  const envPath = join(process.env.HOME ?? '', '.config', 'zenterm', '.env');
  if (!existsSync(envPath)) {
    throw new Error(`設定ファイルが見つかりません: ${envPath}`);
  }
  const contents = readFileSync(envPath, 'utf8');
  const map = new Map<string, string>();
  for (const line of contents.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  const token = map.get('AUTH_TOKEN');
  if (!token) throw new Error('AUTH_TOKEN が .env に見つかりません。');
  return { token, port: Number.parseInt(map.get('PORT') ?? '18765', 10) };
}

export async function runQrCommand(options: RunQrOptions = {}): Promise<void> {
  const log = options.log ?? console.log;
  const ip = getPrimaryAddress();
  if (!ip) {
    throw new Error('ネットワークアドレスを検出できませんでした。');
  }
  const { token, port } = readEnv();
  const url = `http://${ip}:${port}`;
  const pairingUrl = `zenterm://connect?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;

  await new Promise<void>((resolve) => {
    qrcodeTerminal.generate(pairingUrl, { small: true }, (code: string) => {
      log('');
      log('  QR コードをモバイルアプリでスキャンしてください:');
      log(code);
      log(`  Pairing URL: ${pairingUrl}`);
      log('');
      resolve();
    });
  });
}
