import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { formatPairingInfo } from '../index.js';

interface RunInfoOptions {
  log?: (message?: unknown) => void;
}

interface NetworkAddresses {
  lan: string | null;
  tailscale: string | null;
}

function getNetworkAddresses(): NetworkAddresses {
  const result: NetworkAddresses = { lan: null, tailscale: null };
  const interfaces = networkInterfaces();
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (name.startsWith('tailscale') || entry.address.startsWith('100.')) {
        result.tailscale ??= entry.address;
      } else {
        result.lan ??= entry.address;
      }
    }
  }
  return result;
}

interface EnvValues {
  token: string;
  port: number;
}

function readEnvFile(): EnvValues {
  const envPath = join(process.env.HOME ?? '', '.config', 'zenterm', '.env');
  if (!existsSync(envPath)) {
    throw new Error(`設定ファイルが見つかりません: ${envPath}\n  zenterm-gateway setup を実行するか、Gateway を起動してください。`);
  }
  const contents = readFileSync(envPath, 'utf8');
  const envMap = new Map<string, string>();
  for (const line of contents.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) envMap.set(match[1], match[2]);
  }
  const token = envMap.get('AUTH_TOKEN');
  if (!token) throw new Error('AUTH_TOKEN が .env に見つかりません。');
  const port = Number.parseInt(envMap.get('PORT') ?? '18765', 10);
  return { token, port };
}

export async function runInfoCommand(options: RunInfoOptions = {}): Promise<void> {
  const log = options.log ?? console.log;
  const { lan, tailscale } = getNetworkAddresses();
  const { token, port } = readEnvFile();
  log('');
  log('--- zenterm gateway ---');
  for (const line of formatPairingInfo({ lan, tailscale, port, token })) {
    log(line);
  }
  log('---------------------------');
  log('');
}
