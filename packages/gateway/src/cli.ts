#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

// --- CLI flag parser ---
function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const prefixArg = `--${name}`;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith(prefix)) {
      return process.argv[i].slice(prefix.length);
    }
    if (process.argv[i] === prefixArg && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
      return process.argv[i + 1];
    }
  }
  return undefined;
}

// --- --help ---
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: zenterm-gateway [options] [command]

Commands:
  setup        サービス登録 (systemd / launchd)
  info         接続用 URL / Token を再表示
  qr           ペアリング QR コードを再表示

Options:
  --port <number>   ポート番号 (default: 18765)
  --host <string>   バインドアドレス (default: 0.0.0.0)
  -h, --help        ヘルプを表示
  -v, --version     バージョンを表示

Environment:
  PORT              ポート番号
  HOST              バインドアドレス
  AUTH_TOKEN        認証トークン
  LOG_LEVEL         ログレベル (debug, info, warn, error)
`);
  process.exit(0);
}

// --- --version ---
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const pkgPath = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  console.log(`zenterm-gateway v${pkg.version}`);
  process.exit(0);
}

// --- CLI flags → env vars (highest priority) ---
const cliPort = parseFlag('port');
const cliHost = parseFlag('host');
if (cliPort) process.env.PORT = cliPort;
if (cliHost) process.env.HOST = cliHost;

// --- setup subcommand ---
if (process.argv[2] === 'setup') {
  const { runSetup } = await import('./setup.js');
  await runSetup();
  process.exit(0);
}

// --- info subcommand ---
if (process.argv[2] === 'info') {
  const { runInfoCommand } = await import('./commands/info.js');
  try {
    await runInfoCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}

// --- qr subcommand ---
if (process.argv[2] === 'qr') {
  const { runQrCommand } = await import('./commands/qr.js');
  try {
    await runQrCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}

const configDir = join(process.env.HOME ?? '', '.config', 'zenterm');
const envPath = join(configDir, '.env');

// tmux check
try {
  execFileSync('tmux', ['-V'], { stdio: 'pipe' });
} catch {
  console.error('Error: tmux が見つかりません。');
  console.error('  Linux:  sudo apt install tmux');
  console.error('  macOS:  brew install tmux');
  process.exit(1);
}

// Interactive .env setup if missing
if (!existsSync(envPath)) {
  console.log('');
  console.log('zenterm-gateway 初回セットアップ');
  console.log('================================');
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let token: string;
  while (true) {
    const input = await rl.question('認証トークン（数字4桁）を入力してください: ');
    const trimmed = input.trim();

    if (/^\d{4}$/.test(trimmed)) {
      token = trimmed;
      break;
    }

    console.log('  → 数字4桁で入力してください（例: 1234）');
  }

  rl.close();

  const content = [
    `AUTH_TOKEN=${token}`,
    'PORT=18765',
    'HOST=0.0.0.0',
    'SESSION_PREFIX=zen_',
    'LOG_LEVEL=info',
    '',
  ].join('\n');

  mkdirSync(configDir, { recursive: true });
  writeFileSync(envPath, content, 'utf8');
  console.log('');
  console.log(`${envPath} を生成しました (AUTH_TOKEN: ${token})`);
  console.log('');
}

// Start server
await import('./index.js');
