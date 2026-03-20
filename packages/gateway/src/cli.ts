#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

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

// Auto-create .env if missing
if (!existsSync(envPath)) {
  const token = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const content = [
    `AUTH_TOKEN=${token}`,
    'PORT=18765',
    'HOST=0.0.0.0',
    'SESSION_PREFIX=psh_',
    'LOG_LEVEL=info',
    '',
  ].join('\n');

  writeFileSync(envPath, content, 'utf8');
  console.log('.env を生成しました (AUTH_TOKEN 自動生成)');
}

// Start server
await import('./index.js');
