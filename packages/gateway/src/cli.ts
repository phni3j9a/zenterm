#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const envPath = resolve(process.cwd(), '.env');

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
  console.log('palmsh-gateway 初回セットアップ');
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
    'SESSION_PREFIX=psh_',
    'LOG_LEVEL=info',
    '',
  ].join('\n');

  writeFileSync(envPath, content, 'utf8');
  console.log('');
  console.log(`.env を生成しました (AUTH_TOKEN: ${token})`);
  console.log('');
}

// Start server
await import('./index.js');
