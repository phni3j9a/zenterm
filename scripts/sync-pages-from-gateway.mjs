#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const filePairs = [
  ['packages/gateway/public/index.html', 'docs/index.html'],
  ['packages/gateway/public/support.html', 'docs/support.html'],
  ['packages/gateway/public/favicon.ico', 'docs/favicon.ico'],
  ['packages/gateway/public/apple-touch-icon.png', 'docs/apple-touch-icon.png'],
];

const dirPairs = [
  ['packages/gateway/public/lp', 'docs/lp'],
];

for (const [sourceRel, targetRel] of filePairs) {
  const sourcePath = resolve(rootDir, sourceRel);
  const targetPath = resolve(rootDir, targetRel);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourceRel}`);
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { force: true });
  console.log(`Synced ${targetRel}`);
}

for (const [sourceRel, targetRel] of dirPairs) {
  const sourcePath = resolve(rootDir, sourceRel);
  const targetPath = resolve(rootDir, targetRel);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source directory: ${sourceRel}`);
  }

  rmSync(targetPath, { recursive: true, force: true });
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true, force: true });
  console.log(`Synced ${targetRel}`);
}
