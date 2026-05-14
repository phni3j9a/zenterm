import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGatewayEnv, fillOtp } from './helpers';

let gateway: ChildProcess;
let baseUrl: string;
let home: string;
const TOKEN = '4815';
const PORT = 18815;

test.beforeAll(async () => {
  let env: NodeJS.ProcessEnv;
  ({ home, env } = createGatewayEnv({
    port: PORT,
    token: TOKEN,
    label: 'zenterm-file-pane-url-restore',
  }));

  // ファイルパネルは初期表示で `~` (HOME) を開くため、demo.txt は HOME 直下に置く。
  writeFileSync(join(home, 'demo.txt'), 'restored');

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

async function presetLocalStorage(
  page: import('@playwright/test').Page,
  opts: { layout?: 'single' | 'cols-2'; panes?: unknown[] } = {},
): Promise<void> {
  const layout = opts.layout ?? 'single';
  const panes = opts.panes ?? [null];
  await page.addInitScript(
    ({ layout, panes }) => {
      localStorage.setItem(
        'zenterm-web-settings',
        JSON.stringify({
          state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
          version: 2,
        }),
      );
      localStorage.setItem(
        'zenterm-web-pane',
        JSON.stringify({
          state: { layout, panes, focusedIndex: 0 },
          version: 3,
        }),
      );
    },
    { layout, panes },
  );
}

test('hash に file エントリがある URL でリロードしてもペインが復元される', async ({ page }) => {
  // 単一 (single + 1 ペイン埋まり) のときは AuthenticatedShell が
  // hash を意図的に空にする (isSinglePaneState 分岐) ため、hash 復元の確認には
  // multi レイアウトを事前にセットして空ペインを 1 つ残しておく。
  await presetLocalStorage(page, { layout: 'cols-2', panes: [null, null] });

  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Step 1: files タブへ切替。
  await page.getByRole('tab', { name: /^files$/i }).click();
  await expect(page).toHaveURL(/\/web\/files(?:[?#/]|$)/);

  // Step 2: demo.txt をクリックしてフォーカスペインに開く。
  await page.getByRole('button', { name: /^demo\.txt$/ }).click();
  await expect(page.getByText('restored').first()).toBeVisible({ timeout: 5000 });

  // Step 3: URL hash に file エントリ (f: / f%3A 双方を許容) が乗っていることを確認。
  //   実装上 paneStateFragment は `f:<encodeURIComponent(path)>` を出力するが、
  //   ブラウザの hash 表記で `:` がそのまま残るか %3A になるかは環境依存のため両対応。
  //   react-router の replace で hash のみが変わるケースは `waitForURL` の
  //   navigation event を発火しないため、location.hash を直接 poll する。
  await expect
    .poll(() => page.evaluate(() => window.location.hash), { timeout: 5000 })
    .toMatch(/#l=[^#]*p=[^#]*f(?::|%3A)/i);

  // Step 4: 同 URL でリロード → 復元後もペインにファイル内容が表示される。
  // ファイルタブ表示中なので Sessions panel ではなく Files panel が見える。
  await page.reload();
  await expect(page.getByRole('tabpanel', { name: /files panel/i })).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText('restored').first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByTitle('demo.txt')).toBeVisible();
});

test('legacy /web/sessions/:id/window/:idx URL は /web/sessions に正規化されペインに反映される', async ({
  page,
}) => {
  // 事前にセッションを API 経由で作成。
  const sessionName = 'e2e-legacy-restore';
  const r = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: sessionName }),
  });
  expect(r.ok).toBe(true);

  await presetLocalStorage(page);

  // 旧 URL に直接 goto。
  // localStorage に未認証なら /web/login にリダイレクトされるため、まず認証を済ませてから
  // 旧 URL に飛ぶ二段構えにする。
  await page.goto(`${baseUrl}/web`);
  await fillOtp(page, TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // 旧 URL に遷移。AuthenticatedShell の一度きりマイグレーションが
  // openInFocusedPane → /web/sessions(+hash) への replace を行う。
  await page.goto(`${baseUrl}/web/sessions/${encodeURIComponent(sessionName)}/window/0`);

  // path が /web/sessions に正規化される (hash は許容)。
  await page.waitForURL(
    (u) => u.pathname === '/web/sessions',
    { timeout: 5000 },
  );

  // ターミナルペインがマウントされ、接続状態に到達することで pane への反映を確認。
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(1, {
    timeout: 10000,
  });
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 10000 });
});
