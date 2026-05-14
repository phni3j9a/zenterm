import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
let home: string;
const TOKEN = '4814';
const PORT = 18814;

test.beforeAll(async () => {
  let env: NodeJS.ProcessEnv;
  ({ home, env } = createGatewayEnv({
    port: PORT,
    token: TOKEN,
    label: 'zenterm-file-in-pane',
  }));

  // demo.txt は HOME 直下に置く。ファイルパネルは初期表示で `~` (HOME) を開くため、
  // 余計なディレクトリ遷移をしないで済む。
  writeFileSync(join(home, 'demo.txt'), 'hello pane');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env,
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.ok) {
      const sessions = (await res.json()) as Array<{ displayName: string }>;
      for (const s of sessions) {
        await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.displayName)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
      }
    }
  } catch {
    /* ignore */
  }
  gateway?.kill();
});

test('サイドバーのファイルクリックでフォーカスペインに表示され、× で空に戻る', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Step 1: files タブへ切替。
  await page.getByRole('tab', { name: /^files$/i }).click();
  await expect(page).toHaveURL(/\/web\/files(?:[?#/]|$)/);
  await expect(page.getByRole('tabpanel', { name: /files panel/i })).toBeVisible({
    timeout: 5000,
  });

  // Step 2: demo.txt をクリック → フォーカスペインに表示。
  await page.getByRole('button', { name: /^demo\.txt$/ }).click();
  await expect(page.getByText('hello pane').first()).toBeVisible({ timeout: 5000 });

  // ヘッダにファイル名が出ていることも確認(プレビューが実体としてマウントされている保証)。
  await expect(page.getByTitle('demo.txt')).toBeVisible();

  // Step 3: × ボタンでペインを閉じる → 空ペイン状態に戻る。
  await page.getByRole('button', { name: /^close$/i }).click();
  await expect(page.getByText('hello pane')).toHaveCount(0);
  await expect(page.getByTitle('demo.txt')).toHaveCount(0);
});
