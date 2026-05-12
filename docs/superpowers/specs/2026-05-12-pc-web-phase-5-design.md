# ZenTerm PC Web 版 — Phase 5 (ポリッシュ) 設計書

> 状態: Phase 1〜4b すべて main にマージ済 (`web-pc-phase-{1, 2a, 2b, 2c, 2d, 3, 4a, 4b}-done`)。Phase 5 は段階リリース表 (`2026-05-09-pc-web-design.md` L502) の最終フェーズ「ポリッシュ（a11y / パフォーマンス / エッジケース / ブラウザ互換 / docs / スクショ）」と各 Phase 引き継ぎ事項を一括で対象とする。

## 背景

Phase 1〜4 までで機能実装と PC 専用 8 機能は完了。各 Phase の plan / spec 内で「Phase 5 へ送る」とマークされた項目と、spec 本体 L502 が要求するポリッシュ作業を統合する。

事前検証の結果、当初の Phase 1 引き継ぎ項目「Light テーマ + system テーマ追従」は Phase 2b 完了時点で `theme/index.ts` および `theme/tokens.ts` で実装済みのため Phase 5 スコープから除外する。

## スコープ

### In scope（Phase 5）

#### A. 機能未実装の回収（5 件）
1. **i18n 6 言語追加** — es / fr / de / pt-BR / zh-CN / ko。`packages/web/src/i18n/locales/` に追加し、`packages/web/src/stores/settings.ts` の `Language` 型と `AppearanceSection.tsx` の `LANGUAGE_OPTIONS` を拡張。mobile (`/home/server/projects/zenterm/app/locales/*.json`) のキーを写し、PC 専用キー (Phase 4a/4b で追加した `sidebar.resize` / `terminal.menu.*` / `terminal.dropHint` / `terminal.uploadProgress` / `terminal.uploadBusy` 等) は機械翻訳しても誰かが目視レビューするまでは `<en の値>` で fallback すること
2. **URL store→URL 逆同期** — 現状は URL→store の一方向のみ (`urlSync.ts`)。focused pane の (sessionId, windowIndex) が変わったら `navigate(..., { replace: true })` で URL に push back。タブ切替 (Sessions ↔ Files ↔ Settings) は対象外、Sessions タブ内の focus 移動のみが対象
3. **URL fragment によるペイン状態圧縮** — `#l=cols-2&p=work.0,dev.1` の形式で layout + 全 pane 配置を URL fragment にエンコード。reload 時に paneStore へ復元
4. **`/web/files/:path*` deep link** — Files タブの現在パスを URL に反映 (`/web/files/home/server/projects/zenterm`)。reload 時に該当パスを開く。`safeDecode` で malformed URI guard
5. **LoginRoute redirect 先 preserve** — `routes/login.tsx:23` のハードコード `'/web/sessions'` を `location.state.from` または URL `?next=` から復元するように変更

#### B. UX / 微改善（4 件）
6. **4 ペイン上限到達時の Toast** — `newPaneFromCurrent` が `upgradeLayout(current) === null` で no-op になる経路で、focus 中のターミナルなどから明示的に Toast を出す経路 (`terminal.menu.newPane` クリック等) では `pushToast({ type: 'info', message: t('terminal.newPaneLimit') })` を発火させる。aria-disabled で塞いでいる経路はそのまま
7. **Tooltip `aria-describedby` clobber 修正** — `Tooltip.tsx:81` を `[childProps['aria-describedby'], id].filter(Boolean).join(' ')` 形式に変更
8. **SidebarResizer の left offset 補正** — `ev.clientX` 直接代入をやめ、`ref` で sidebar `getBoundingClientRect().left` を取得し `ev.clientX - left` を使用。Sidebar 配置が変わっても破綻しない
9. **events debounce 実測調整** — `REFETCH_DEBOUNCE_MS` を 50ms から実機計測 (Mac mini t2 / iPad Safari) で適切値へ。設定不要なら現状値を計測根拠コメント付きで温存

#### C. パフォーマンス / リソース（2 件）
10. **Sidebar drag 中の xterm refit debounce** — pointer drag 中は paneStore 変化が連続発生。`XtermView.tsx` の `ResizeObserver` 内で「直近 50ms 以内に再発火していたらスキップして trailing edge で 1 回だけ fit」する debounce を追加。drag 終了時の最終形は必ず fit
11. **4 ペイン同時ストレステスト** — spec L559 が要求する `yes` 大量出力 × 4 ペイン同時稼働で xterm scrollback 5000 上限 / WebSocket 帯域 / GC 回数を計測。手動テスト script を `tests/manual/` 配下に追加 (npm script `npm run stress:web` を新設)

#### D. 互換性 / a11y（3 件）
12. **a11y 監査** — axe-core を依存に追加し `tests/e2e/web/a11y.spec.ts` で全主要画面 (login / sessions / files / settings / palette / context menu) をスキャン。重大度 critical / serious を 0 件にする。NVDA / VoiceOver 手動確認は手動チェックリスト化
13. **ブラウザ互換マトリクス検証** — Safari 17 / Firefox 122 / Chrome 122 / iPad Safari の各環境で手動チェックリスト一巡。`<dialog>` polyfill は Safari 15.4+ 対象とし polyfill 導入はしない (ブラウザ要件として明文化)
14. **iPad リグレッション確認** — spec L549-553 の「iPad リグレッション防止」項目を一巡。`/embed/terminal` は無変更を確認、`/web/*` を iPad で開いた場合に Sidebar collapse 強制等の必要性を判断

#### E. リファクタ / テスト補強（3 件）
15. **ContextMenu 共通基盤化** — `TerminalContextMenu` / `RowActionsMenu` / `FilesContextMenu` / `FilesSortMenu` の 4 種類で重複している「Escape で閉じる / 外側クリックで閉じる / Portal 配置 / focus trap / role="menu"」を `components/ui/ContextMenu.tsx` に集約。各既存 menu は viewmodel と items 配列を渡すだけにする。i18n キーは温存
16. **E2E カバレッジ追加** — 以下 3 件を `tests/e2e/web/phase5-coverage.spec.ts` に統合追加:
    - pointer drag による SidebarResizer 動作 (mouse.down/move/up が動かなければ `dispatchEvent` で `PointerEvent` を直接発火)
    - 実 D&D ファイルアップロード (`page.evaluate` で `DataTransfer` を構築して `dispatchEvent('drop')`)
    - TerminalContextMenu の右クリック → Copy / Paste / Clear / Search / New pane の各動作
17. **docs / README / スクショ更新** — `docs/roadmap.md` に PC Web 版完了を追記、トップ README に PC Web スクリーンショット 4 枚 (login / sessions multi-pane / files / settings) を追加、`docs/screenshots/` 配下に png を配置

### Out of scope（v2 以降）

- マルチユーザー / 招待
- セッション共有 URL のクリップボード共有 UX (現状は session ID コピーボタンで代替)
- iPad 専用レイアウト最適化 (Phase 5 では互換確認のみ、新規 UI は v2)
- Service Worker による offline 動作
- WebGL renderer 切替 (xterm.js の canvas → webgl)

### 触らないもの

- Gateway 側 (Phase 1 の `/web` route, showPairingInfo, info/qr CLI) — 変更不要
- Mobile `/embed/terminal` 配信 — 完全に分離 (spec L564)
- `@zenterm/shared` 既存型 — i18n キー追加のみ、既存変更は app 側影響確認後
- `packages/gateway/public/web/` のうち assets/* は build 成果物のみ、手動編集しない

## 設計詳細

### A1. i18n 6 言語追加

**ファイル:**
- 追加: `packages/web/src/i18n/locales/{es,fr,de,pt-BR,zh-CN,ko}.json`
- 修正: `packages/web/src/i18n/index.ts` (resources 登録)
- 修正: `packages/web/src/stores/settings.ts` (`Language` 型を 8 言語に拡張、`migrate` で旧値 fallback)
- 修正: `packages/web/src/components/settings/AppearanceSection.tsx` (`LANGUAGE_OPTIONS` に 6 言語追加)

**手順:**
1. mobile `/home/server/projects/zenterm/app/locales/<lang>.json` を読み、PC web で使用しているキー (`common`, `sidebar`, `login`, `sessions`, `terminal`, `validation`, `settings`, `palette`, `files`) を抽出
2. 不足キー (Phase 4a/4b で追加した `terminal.menu.search`, `terminal.menu.newPane`, `terminal.dropHint`, `terminal.uploadProgress`, `terminal.uploadDone`, `terminal.uploadError`, `terminal.uploadBusy`, `sidebar.resize`) は機械翻訳または英語のままで挿入し、JSON に `"_TODO_review": true` を上位に書いてレビュー対象を明示
3. `i18next` の `resources` に追加、`fallbackLng: 'en'` は維持

**i18n キー欠落の検証:** Phase 5 完了時に `scripts/check-i18n-parity.ts` を新設し全 locale で en と同じキーセットを持つことをチェック (npm `test:i18n`)

### A2. URL 逆同期

**ファイル:**
- 修正: `packages/web/src/lib/urlSync.ts` (新エクスポート `buildSessionPath(sessionId, windowIndex)` を追加)
- 修正: `packages/web/src/components/AuthenticatedShell.tsx` (`useEffect` で focused pane 変化を購読し `navigate(buildSessionPath(...), { replace: true })`)

**競合回避:**
- 既存の URL→store sync (lastSyncedPath ref) と相互ループしないよう、`navigate` の前に `location.pathname === buildSessionPath(...)` で no-op 判定
- Files / Settings タブにいる時は逆同期しない (`isFilesRoute / isSettingsRoute` を条件に含める)

### A3. URL fragment による pane 状態圧縮

**形式:** `#l=<layoutMode>&p=<sessionId>.<windowIndex>[,...]`
- 例: `#l=grid-2x2&p=work.0,work.2,dev.0,_` (`_` = empty slot)
- `,` 区切り、empty は `_` 1 文字、`.` 区切り
- sessionId は `encodeURIComponent` (`.` `,` を含む可能性に備えて)

**ファイル:**
- 追加: `packages/web/src/lib/paneStateFragment.ts` (`encode(state): string`, `decode(hash: string): { layout, panes } | null`)
- 修正: `packages/web/src/components/AuthenticatedShell.tsx` (URL→store sync useEffect で `location.hash` を読み、decode 成功時は `setLayout` + `assignPane` をバッチで実行)
- 修正: `packages/web/src/components/AuthenticatedShell.tsx` (逆同期で `pushHash(encode(state))`)

**malformed hash の扱い:** decode が null を返したら無視して既定状態 (single) で起動

### A4. /web/files/:path* deep link

**ファイル:**
- 修正: `packages/web/src/App.tsx` (`<Route path="/web/files/*">` を追加)
- 修正: `packages/web/src/routes/files.tsx` (`useParams` の `*` を `safeDecode` してから `useFilesStore.setCwd()` を初期化時に発火)
- 修正: Files navigation 側 (`FilesPanel` の `setCwd` 呼び出し直後に `navigate(\`/web/files/${encodeURIComponent(path)}\`, { replace: true })`)

**URL 形式:** `/web/files/home/server/projects/zenterm` (path segments を `/` 区切りで保持、各 segment は encodeURIComponent。reload 時の SPA fallback は Gateway 側で対応済)

### A5. LoginRoute redirect 先 preserve

**ファイル:**
- 修正: `packages/web/src/routes/login.tsx`
- 修正: `packages/web/src/components/AuthenticatedShell.tsx` (`<Navigate to="/web/login" state={{ from: location }} replace />`)

**動作:**
1. 未認証 redirect 時に `state.from` で元 URL を保持
2. ログイン成功時に `state.from.pathname + state.from.search + state.from.hash` へ navigate、なければ `/web/sessions`
3. `from` が `/web/login` だった場合は無限ループ回避で `/web/sessions` へ fallback
4. `phase4b.spec.ts:85` のコメントを削除 (deep link が機能するように)

### B6. 4 ペイン上限 Toast

**ファイル:**
- 修正: `packages/web/src/components/AuthenticatedShell.tsx` (`newPaneFromCurrent` で `upgradeLayout === null` の時 `pushToast({ type: 'info', message: t('terminal.newPaneLimit') })`)
- 修正: `packages/web/src/i18n/locales/{en,ja}.json` に `terminal.newPaneLimit` 追加
  - en: `"Maximum pane count reached"`
  - ja: `"ペイン数の上限に達しました"`

**注意:** `canCreateNewPane=false` で aria-disabled になっているメニューアイテムからは click ハンドラが発火しないので、Toast を出す経路はキーボードショートカット (今後追加されたら) や Palette からの呼び出し向け。現状のクリック経路では発火しないが、API としては `newPaneFromCurrent` に内包しておくことで将来の経路追加で恩恵を受ける

### B7. Tooltip aria-describedby clobber 修正

**ファイル:** `packages/web/src/components/ui/Tooltip.tsx:81`

**修正前:** `'aria-describedby': visible ? id : childProps['aria-describedby']`
**修正後:** `'aria-describedby': visible ? [childProps['aria-describedby'], id].filter(Boolean).join(' ') : childProps['aria-describedby']`

**テスト:** `Tooltip.test.tsx` に「既存 aria-describedby を持つ child に Tooltip を被せたとき、visible 時に space-joined になる」ケースを追加

### B8. SidebarResizer の left offset 補正

**ファイル:** `packages/web/src/components/sidebar/SidebarResizer.tsx`

**修正:** `<aside>` の DOM ref を `forwardRef` 経由で SidebarResizer に渡すか、`document.querySelector('aside[role="complementary"]')` を `useEffect` 内で取得し `useRef` に保存。`onMove` で `pendingRef.current = ev.clientX - asideLeftRef.current` に変更

**判定:** 現状の DOM 構造では `aside` が左端 (x=0) にあるため 0 を引いても動作するが、将来のレイアウト変更で破綻するため修正する

### B9. events debounce 実測

**手順:**
1. Mac mini t2 + Chrome / iPad Safari の 2 環境で計測 script を実行 (sessions を 10〜50 持つ状態で events を 50/s 程度の頻度で発火させ、fetch 回数 / UI 反映遅延を測定)
2. 50ms が適切なら `useEventsSubscription.ts:8` に「計測根拠 (2026-05-XX YYYY 環境で fetch 数 N 回 / 反映遅延 M ms)」コメントを追加
3. 不適切なら値を変更しコメント追記

### C10. xterm refit debounce

**ファイル:** `packages/web/src/components/terminal/XtermView.tsx` (L398-415 周辺)

**実装案:**
```typescript
const FIT_DEBOUNCE_MS = 50;
const lastFitAt = useRef(0);
const trailingTimer = useRef<number | null>(null);
const ro = new ResizeObserver(() => {
  if (!isVisibleRef.current) return;
  const now = performance.now();
  const elapsed = now - lastFitAt.current;
  if (elapsed >= FIT_DEBOUNCE_MS) {
    lastFitAt.current = now;
    requestAnimationFrame(() => { fit.fit(); /* + send resize */ });
  } else {
    if (trailingTimer.current !== null) clearTimeout(trailingTimer.current);
    trailingTimer.current = window.setTimeout(() => {
      lastFitAt.current = performance.now();
      requestAnimationFrame(() => { fit.fit(); /* + send resize */ });
      trailingTimer.current = null;
    }, FIT_DEBOUNCE_MS - elapsed);
  }
});
```

**判定:** 実装前に Mac mini 4 ペインで sidebar drag を計測。`fit()` 1 回が 5ms 以下なら debounce 不要 (現状でも 200fps 相当)。10ms 超なら導入

### C11. 4 ペイン同時ストレステスト

**ファイル:**
- 追加: `tests/manual/stress-4-pane.md` (手順書)
- 追加: `scripts/stress/spawn-yes.sh` (4 セッション同時に `yes "test output line"` を 60 秒流す)
- 追加: `package.json` の root scripts に `"stress:web": "bash scripts/stress/spawn-yes.sh"`

**計測項目:**
- メモリ使用量 (Activity Monitor / `top`)
- xterm scrollback 5000 上限が効いているか (DevTools で `terminal.buffer.active.length` を観測)
- WebSocket 帯域 (Network タブ Frames)
- フォントレンダリング遅延 (`requestAnimationFrame` 時間)

**Pass 条件:** Mac mini で 4 ペイン同時 `yes` × 60 秒で OOM せず、UI が応答する

### D12. axe-core a11y 監査

**ファイル:**
- 追加: `tests/e2e/web/a11y.spec.ts`
- 追加: `package.json` (`@axe-core/playwright` を devDependencies に)

**テスト構造:**
```typescript
import AxeBuilder from '@axe-core/playwright';
const pages = [
  { name: 'login', path: '/web/login' },
  { name: 'sessions', path: '/web/sessions' },
  { name: 'files', path: '/web/files' },
  { name: 'settings', path: '/web/settings' },
];
for (const p of pages) {
  test(`a11y: ${p.name}`, async ({ page }) => {
    // ログイン後 navigate
    const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze();
    expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
}
```

**手動チェックリスト追加:**
- `tests/manual/a11y-checklist.md` に NVDA (Windows) / VoiceOver (macOS) / TalkBack (Android Chrome) 各環境での操作シナリオ 10 件を記載

### D13. ブラウザ互換マトリクス

**ファイル:** `tests/manual/browser-matrix.md`

**対象:**
| ブラウザ | 最低バージョン | テスト方法 |
|---|---|---|
| Chrome / Edge | 122 | E2E 自動 |
| Firefox | 122 | E2E 自動 |
| Safari (macOS) | 17 | 手動 (Playwright webkit でカバーは限界) |
| iPad Safari | 17 | 手動 |

**手動チェック項目 (各ブラウザ共通):** spec L538-548 の項目一巡

### D14. iPad リグレッション

**ファイル:** `tests/manual/ipad-regression.md`

**チェック内容:**
- `/embed/terminal` が PC web build 後も無変更で表示される (`packages/gateway/public/web/` の build artifact 配置が `/embed/*` と衝突しない)
- `/web/sessions` を iPad Safari で開いた場合の挙動 (Sidebar drag、フォーカスリング等)
- /embed と /web の併用が問題ないか (同時に開く)

**判定:** iPad 専用ハック (`/web/*` 路径アクセスで mobile WebView へ redirect 等) は v2 へ送る。Phase 5 はあくまで「壊れていないこと」の確認のみ

### E15. ContextMenu 共通基盤化

**ファイル:**
- 追加: `packages/web/src/components/ui/ContextMenu.tsx`
- 追加: `packages/web/src/components/ui/__tests__/ContextMenu.test.tsx`
- 修正: `packages/web/src/components/terminal/TerminalContextMenu.tsx` (新基盤を import して薄いラッパに)
- 修正: `packages/web/src/components/sidebar/RowActionsMenu.tsx` (同上)
- 修正: `packages/web/src/components/files/FilesContextMenu.tsx` (同上)
- 修正: `packages/web/src/components/files/FilesSortMenu.tsx` (同上)

**新基盤 API:**
```typescript
interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  separator?: boolean; // 表示のみ
  shortcut?: string; // 右側表記
}
interface ContextMenuProps {
  anchorPoint?: { x: number; y: number }; // ポップアップ位置 (clientX/clientY)
  anchorEl?: HTMLElement | null; // または要素基準
  open: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  ariaLabel: string;
}
```

**共通化対象機能:**
- Escape で閉じる
- 外側クリックで閉じる (capture phase)
- focus trap + 矢印キーナビゲーション
- role="menu" / "menuitem"
- Portal 配置 (`createPortal(_, document.body)`)
- 画面端調整 (viewport の右端 / 下端を超えるなら反転)

**i18n キー:** 既存キーを温存。`ContextMenu` 自体は label を items から受け取るので i18n 知識を持たない

### E16. E2E カバレッジ追加

**ファイル:** `tests/e2e/web/phase5-coverage.spec.ts`

**spec 構成:**
```typescript
test('Sidebar pointer drag changes width', async ({ page }) => {
  await loginAndWait(page);
  const handle = page.getByRole('separator', { name: /resize/i });
  const box = await handle.boundingBox();
  // Playwright の page.mouse が動かない場合は dispatchEvent fallback
  await page.evaluate(({ x, y }) => {
    const handle = document.querySelector('[role="separator"]')!;
    handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + 80, clientY: y, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: x + 80, clientY: y, bubbles: true }));
  }, { x: box!.x + 3, y: box!.y + 50 });
  const aside = page.locator('aside[role="complementary"]');
  await expect(aside).toHaveAttribute('style', /width:\s*4\d\dpx/);
});

test('Terminal pane accepts real file drop', async ({ page }) => {
  await loginAndWait(page);
  // セッション作成 + フォーカス
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['hello'], 'test.txt'));
    const term = document.querySelector('[data-testid="terminal-pane-0"]')!;
    term.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    term.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
  });
  await expect(page.getByText(/Uploaded 1 file/)).toBeVisible();
});

test('TerminalContextMenu shows on right-click and items work', async ({ page }) => {
  await loginAndWait(page);
  await page.locator('[data-testid^="terminal-pane-"]').first().click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /copy/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /paste/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /clear/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /search/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /new pane/i })).toBeVisible();
});
```

**ポート割当:** 18814 / token 4814 (Phase 4b の 18813 と衝突回避)

### E17. docs / README / スクショ

**ファイル:**
- 修正: `docs/roadmap.md` (PC Web 版完了セクション追加)
- 修正: `README.md` (root) — PC Web 版スクリーンショット 4 枚を埋め込み
- 追加: `docs/screenshots/web-pc-{login,sessions,files,settings}.png` (Playwright で `page.screenshot()` 自動生成 + 手動で OK 判定)
- 追加: `docs/changelog-phase5.md` (Phase 1〜5 まとめ、ユーザ向け変更点)

## アーキテクチャへの影響

### 既存ストアへの影響
- `useLayoutStore` — 変更なし
- `usePaneStore` — 変更なし (fragment encode/decode は別 lib として外出し)
- `useSettingsStore` — `Language` 型を 8 言語に拡張、persist `migrate` で旧値 fallback (version は 2 のまま)
- `useFilesStore` — 変更なし (URL deep link は route 側で `setCwd` を呼ぶだけ)

### 新規ファイル
- `packages/web/src/lib/paneStateFragment.ts`
- `packages/web/src/components/ui/ContextMenu.tsx`
- `packages/web/src/i18n/locales/{es,fr,de,pt-BR,zh-CN,ko}.json`
- `scripts/check-i18n-parity.ts`
- `scripts/stress/spawn-yes.sh`
- `tests/e2e/web/{a11y,phase5-coverage}.spec.ts`
- `tests/manual/{stress-4-pane,a11y-checklist,browser-matrix,ipad-regression}.md`
- `docs/changelog-phase5.md`
- `docs/screenshots/web-pc-*.png`

### 破壊的変更
なし。URL 形式は新規追加のみ (`/web/sessions/:id` / `/web/files/:path*` / `#l=...&p=...`)、既存 URL は引き続き機能する。

## i18n キー追加一覧

| キー | en | ja |
|---|---|---|
| `terminal.newPaneLimit` | Maximum pane count reached | ペイン数の上限に達しました |

(6 言語 locale は上記キーを含む全キーを写す。Phase 4a/4b で追加されたキーを各言語に揃える)

## テスト方針

### ユニット (Vitest)
- `paneStateFragment.test.ts`: encode/decode 往復、malformed hash 拒否
- `urlSync.test.ts` の拡張: `buildSessionPath` 単体
- `Tooltip.test.tsx`: aria-describedby マージのケース追加
- `SidebarResizer.test.tsx`: getBoundingClientRect を mock し offset 補正を検証
- `ContextMenu.test.tsx`: 開閉 / Escape / 外側 click / 矢印キーナビ / 画面端反転
- `settings.test.ts`: `Language` 型拡張で旧値 (en/ja) を保持できる migrate

### E2E (Playwright)
- `phase5-coverage.spec.ts`: pointer drag / real drop / right-click menu の 3 件
- `a11y.spec.ts`: 4 画面 axe scan

### 手動 (Phase 5 完了の DoD)
- `tests/manual/a11y-checklist.md` 一巡
- `tests/manual/browser-matrix.md` 一巡
- `tests/manual/ipad-regression.md` 一巡
- `tests/manual/stress-4-pane.md` 一巡

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| 6 言語の翻訳品質 | UX 低下 | Phase 5 では英語 fallback + `_TODO_review` フラグで未レビューを明示。完全な翻訳品質は v2 で native speaker レビュー |
| URL fragment 圧縮が複雑化 | URL シェアの実用性低下 | encode は 最大 4 pane × `<sid>.<idx>` 形式と短く、fragment 長 < 200 文字を維持 |
| ContextMenu 共通基盤化で既存 menu が回帰 | 機能後退 | リファクタ前後で同じ unit テストを通すこと + 既存 e2e (terminal-context-menu.spec.ts) を維持 |
| axe-core で大量の serious 検出 | Phase 5 が長期化 | critical / serious のみを Pass 条件にし、moderate / minor は別 issue へ |
| iPad で `/web/*` が破綻 | mobile UX 損失 | Phase 5 ではあくまで「壊れていないこと」を確認、修正は v2 へ |
| 4 ペインストレスで OOM | Mac mini ハング | spawn-yes.sh は事前に `ulimit -v` で仮想メモリ制限、Pass しなければ scrollback を 3000 に下げる |

## 完了基準 (DoD)

- [ ] **A1〜A5 機能追加**: 6 言語 / URL 逆同期 / fragment 圧縮 / Files deep link / Login redirect preserve すべて実装、unit/E2E パス
- [ ] **B6〜B9 改善**: Toast / Tooltip / SidebarResizer / events debounce すべて実装、unit テスト パス
- [ ] **C10〜C11 性能**: refit debounce 計測 + 必要なら導入、ストレステスト Pass
- [ ] **D12〜D14 互換性**: axe-core serious 0 件、手動チェックリスト 3 種一巡
- [ ] **E15〜E17 リファクタ/補強**: ContextMenu 共通基盤化、E2E 3 件追加、docs/README 更新
- [ ] Vitest 全件 PASS、tsc clean、Playwright 全件 PASS
- [ ] `npm run check` (root) で lint / typecheck / test がすべて green
- [ ] `git tag web-pc-phase-5-done` 押下、`main` へ `--no-ff` merge 済

## 段階分割の判断

Phase 1〜4 と同様に sub-phase 分割が必要か検討した結果、Phase 5 は以下 2 段階で十分:

### Phase 5a: 機能追加と UX 改善 (A + B カテゴリ、9 件)
- A1 i18n / A2 URL 逆 / A3 fragment / A4 Files deep link / A5 Login preserve
- B6 Toast / B7 Tooltip / B8 SidebarResizer offset / B9 events debounce

### Phase 5b: 性能・互換性・リファクタ・テスト補強 (C + D + E カテゴリ、8 件)
- C10 refit debounce / C11 ストレス
- D12 a11y / D13 ブラウザ / D14 iPad
- E15 ContextMenu / E16 E2E / E17 docs

各 sub-phase で個別の plan 文書を `docs/superpowers/plans/` に作成して subagent-driven で実装する。

## Phase 1〜4 引き継ぎ事項の対応マッピング

| 引き継ぎ元 | 項目 | Phase 5 対応 |
|---|---|---|
| Phase 1 | i18n 8 言語 | A1 |
| Phase 1 | Light/system テーマ | ✅ Phase 2b で完了済 (Phase 5 対象外) |
| Phase 2a | events debounce 実測 | B9 |
| Phase 2a | `<dialog>` polyfill | D13 (Safari 15.4+ をブラウザ要件として明文化、polyfill 入れない) |
| Phase 2b | Settings sticky / 折りたたみ | (Phase 5 では対象外、UX 影響軽微なため v2 候補に再分類) |
| Phase 3 | 残り 6 言語 | A1 |
| Phase 4a | Tooltip aria-describedby clobber | B7 |
| Phase 4b | URL 逆同期 | A2 |
| Phase 4b | fragment 圧縮 | A3 |
| Phase 4b | /web/files/:path* | A4 |
| Phase 4b | LoginRoute redirect preserve | A5 |
| Phase 4b | 4 ペイン Toast | B6 |
| Phase 4b | ContextMenu 共通基盤 | E15 |
| Phase 4b | refit debounce | C10 |
| Phase 4b | SidebarResizer offset | B8 |
| Phase 4b | E2E カバレッジ | E16 |
| spec L502 | a11y / 性能 / docs / スクショ | D12, C11, E17 |
| spec L538 | 手動検証チェックリスト | D12〜D14 |
| spec L549 | iPad リグレッション | D14 |
| spec L559 | 4 ペインストレス | C11 |

**判定で除外したもの:**
- Settings panel sticky / 折りたたみ (Phase 2b 引き継ぎ): UX 影響が軽微で実装コスト > 効果のため v2 へ
- Light/system テーマ (Phase 1 引き継ぎ): すでに Phase 2b で実装完了済

## v2 候補へ送る項目

Phase 5 完了後も残るもの (今回 spec に含めない):
- Settings panel sticky / 折りたたみ
- iPad 専用 UI 最適化
- 8 言語の native speaker レビュー (Phase 5 では機械翻訳 + 未レビューマーク)
- Service Worker offline 対応
- WebGL renderer
- マルチユーザー共有 URL

