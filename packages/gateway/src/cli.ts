#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import type { AgentType } from '@zenterm/shared';

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
  integrate    エージェント hook の管理

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

// --- integrate subcommand ---
if (process.argv[2] === 'integrate') {
  const arg = process.argv[3];

  // --status: show integration status
  if (arg === '--status' || arg === '-s') {
    const { loadStore, getIntegrations } = await import('./services/notification-store.js');
    loadStore();
    const integrations = getIntegrations();
    const agents = ['claude-code', 'codex', 'copilot-cli'] as const;
    console.log('\n連携ステータス:');
    for (const a of agents) {
      const s = integrations[a];
      const status = s?.installed ? '✅ インストール済み' : '❌ 未インストール';
      const path = s?.configPath ? ` (${s.configPath})` : '';
      console.log(`  ${a}: ${status}${path}`);
    }
    console.log('');
    process.exit(0);
  }

  // --remove: uninstall hook
  if (arg === '--remove' || arg === '-r') {
    const agent = process.argv[4];
    if (!agent || !['claude-code', 'codex', 'copilot-cli'].includes(agent)) {
      console.error('使用法: zenterm-gateway integrate --remove <claude-code|codex|copilot-cli>');
      process.exit(1);
    }
    const installer = await import('./services/integration-installer.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await installer.uninstallHook(agent as any);
    console.log(`${agent} の hook をアンインストールしました`);
    process.exit(0);
  }

  // --all: install all agents
  if (arg === '--all' || arg === '-a') {
    const installer = await import('./services/integration-installer.js');
    const { loadStore, setIntegrationStatus } = await import('./services/notification-store.js');
    loadStore();
    const agents = ['claude-code', 'codex', 'copilot-cli'] as const;
    for (const a of agents) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await installer.installHook(a as any);
        setIntegrationStatus(a, { installed: true, configPath: result.configPath });
        console.log(`✅ ${a}: インストール完了 (${result.configPath})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ ${a}: ${msg}`);
      }
    }
    process.exit(0);
  }

  // Single agent install
  const agent = arg;
  if (!agent || !['claude-code', 'codex', 'copilot-cli'].includes(agent)) {
    console.log(`使用法: zenterm-gateway integrate <エージェント名|--all|--status|--remove>

エージェント名:
  claude-code    Claude Code の hook をインストール
  codex          Codex の notify をインストール
  copilot-cli    Copilot CLI の hook をインストール

オプション:
  --all, -a      全エージェントにインストール
  --status, -s   連携ステータスを表示
  --remove, -r   指定エージェントの hook をアンインストール
`);
    process.exit(1);
  }

  const installer = await import('./services/integration-installer.js');
  const { loadStore, setIntegrationStatus } = await import('./services/notification-store.js');
  loadStore();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await installer.installHook(agent as any);
    setIntegrationStatus(agent as AgentType, { installed: true, configPath: result.configPath });
    console.log(`✅ ${agent}: インストール完了 (${result.configPath})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${agent}: ${msg}`);
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
