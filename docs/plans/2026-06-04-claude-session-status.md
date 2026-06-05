# Claude セッション活動ステータス表示 — 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tmux の `pane_title` グリフから Claude Code の「作業中 / 入力待ち / Claude無」を判定し、ZenTerm Web のセッション一覧のウィンドウ行にリアルタイムなステータスバッジを表示する。

**Architecture:** Claude Code が OSC で設定するタイトル（点字スピナー＝作業中 / `✳`＝入力待ち）を tmux が `pane_title` に保持している。これを `pane_current_command` でゲートしつつ純関数で分類し、(a) `GET /api/sessions`（`listWindows` 経由）でオンデマンド付与、(b) WS 接続中だけ動く poller が `list-windows -a` を ~2s 間隔で見て派生状態の変化時だけ `claude-status-changed` を broadcast、の 2 経路（同一書式・同一分類器）で配信する。Web は既存の `/ws/events` 購読 + `/api/sessions` refetch 経路にそのまま乗せる。

**Tech Stack:** TypeScript, Node.js, Fastify, ws, node-pty, tmux, Vitest（gateway/web）, React 19, zustand, react-i18next, @testing-library/react。

**設計書:** `server/docs/specs/2026-06-04-claude-session-status-design.md`

**全コミット共通:** メッセージ末尾に `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` を付ける。

---

## 前提: 作業ブランチ作成

現在 `main`。作業前にブランチを切る。

- [ ] **Step 0: ブランチ作成**

```bash
cd /home/server/projects/zenterm/server
git checkout -b feat/claude-session-status
```

---

## ファイル構成（このプランで触る範囲）

| 種別 | パス | 責務 |
|---|---|---|
| 変更 | `packages/shared/src/index.ts` | `ClaudeActivity` / `ClaudeWindowStatus` 型、`TmuxWindow.claudeStatus`、`TmuxEvent` に `claude-status-changed` 追加 |
| 新規 | `packages/gateway/src/services/claudePaneStatus.ts` | `deriveClaudeStatus()` 純関数 + 分類定数 |
| 変更 | `packages/gateway/src/services/tmux.ts` | 窓書式に command/title 追加、`parseWindowLine` で `claudeStatus` 付与、`parseWindowLine`/`tmuxWindowListFormat` を export |
| 変更 | `packages/gateway/src/services/tmuxControl.ts` | `publish()` 公開メソッド追加 |
| 新規 | `packages/gateway/src/services/claudeStatusPoller.ts` | `computeStatusSignature()` 純関数 + `ClaudeStatusPoller`（refcount/interval/tick） |
| 変更 | `packages/gateway/src/routes/events.ts` | poller を WS 接続/切断で acquire/release |
| 変更 | `packages/web/src/hooks/useEventsSubscription.ts` | `claude-status-changed` を refetch トリガに追加 |
| 新規 | `packages/web/src/components/sidebar/ClaudeStatusBadge.tsx` | バッジ描画コンポーネント |
| 変更 | `packages/web/src/components/sidebar/WindowRow.tsx` | 行頭にバッジ枠を挿入 |
| 変更 | `packages/web/src/index.css` | `@keyframes zen-status-pulse` 追加 |
| 変更 | `packages/web/src/i18n/locales/*.json`（8 言語） | `sessions.claudeStatus.working/waiting` |

テストコマンド:
- gateway: `cd packages/gateway && npx vitest run <path>`
- web: `cd packages/web && npx vitest run <path>`

---

## Task 1: 共有型の追加

**Files:**
- Modify: `packages/shared/src/index.ts`（`TmuxWindow` 付近 + `TmuxEvent`）

- [ ] **Step 1: 型を追加**

`packages/shared/src/index.ts` の `TmuxWindow` の直前に型を追加し、`TmuxWindow` に `claudeStatus` を、`TmuxEvent` に新メンバーを足す。

`TmuxWindow` の直前へ挿入:

```ts
/** ウィンドウで動く Claude Code の活動状態 */
export type ClaudeActivity = 'working' | 'waiting';

/** ウィンドウ単位の Claude ステータス（不在のときは undefined） */
export interface ClaudeWindowStatus {
  activity: ClaudeActivity;
  /** タイトルの作業概要（先頭グリフ除去後）。ツールチップ用、省略可 */
  summary?: string;
}
```

`TmuxWindow` に 1 行追加:

```ts
export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
  zoomed: boolean;
  paneCount: number;
  cwd: string;
  /** Claude が動いている場合のみ設定（不在のときは undefined） */
  claudeStatus?: ClaudeWindowStatus;
}
```

`TmuxEvent` にメンバー追加:

```ts
export type TmuxEvent =
  | { type: 'sessions-changed' }
  | { type: 'windows-changed' }
  | { type: 'monitor-restart' }
  | { type: 'claude-status-changed' };
```

- [ ] **Step 2: 型チェックが通ることを確認**

Run: `cd packages/gateway && npx tsc --noEmit`
Expected: エラーなし（`@zenterm/shared` は src を直接 types 公開のためビルド不要。既存コードは新フィールドが optional なので壊れない）

- [ ] **Step 3: コミット**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add ClaudeWindowStatus types and claude-status-changed event"
```

---

## Task 2: `deriveClaudeStatus` 純関数

**Files:**
- Create: `packages/gateway/src/services/claudePaneStatus.ts`
- Test: `packages/gateway/src/__tests__/services/claudePaneStatus.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/gateway/src/__tests__/services/claudePaneStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveClaudeStatus } from '../../services/claudePaneStatus.js';

describe('deriveClaudeStatus', () => {
  it('点字スピナー先頭グリフ → working', () => {
    expect(deriveClaudeStatus('claude', '⠂ hiroshima リポジトリ解説')).toEqual({
      activity: 'working',
      summary: 'hiroshima リポジトリ解説',
    });
    // 別フレームでも working
    expect(deriveClaudeStatus('claude', '⠐ x')?.activity).toBe('working');
    expect(deriveClaudeStatus('claude', '⣿ y')?.activity).toBe('working');
  });

  it('✳(U+2733) 先頭グリフ → waiting', () => {
    expect(deriveClaudeStatus('claude', '✳ XT5カメラ処理')).toEqual({
      activity: 'waiting',
      summary: 'XT5カメラ処理',
    });
  });

  it('claude 終了後の stale タイトル（command=zsh）→ undefined', () => {
    expect(deriveClaudeStatus('zsh', '⠐ 残骸タイトル')).toBeUndefined();
  });

  it('node 直起動 + 既知グリフ → 在席', () => {
    expect(deriveClaudeStatus('node', '⠂ task')?.activity).toBe('working');
  });

  it('node だが既知グリフ無し（無関係な node アプリ）→ undefined', () => {
    expect(deriveClaudeStatus('node', 'vite dev server')).toBeUndefined();
  });

  it('claude 在席だがグリフ不明 → waiting、summary は全体', () => {
    expect(deriveClaudeStatus('claude', 'server-Macmini')).toEqual({
      activity: 'waiting',
      summary: 'server-Macmini',
    });
  });

  it('summary が空なら省略', () => {
    expect(deriveClaudeStatus('claude', '✳')).toEqual({ activity: 'waiting' });
    expect(deriveClaudeStatus('claude', '⠂   ')).toEqual({ activity: 'working' });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/claudePaneStatus.test.ts`
Expected: FAIL（`Cannot find module '../../services/claudePaneStatus.js'`）

- [ ] **Step 3: 実装を書く**

`packages/gateway/src/services/claudePaneStatus.ts`:

```ts
import type { ClaudeActivity, ClaudeWindowStatus } from '@zenterm/shared';

// 点字ブロック（スピナーのコマ）。先頭がこの範囲 → 作業中。
const BRAILLE_MIN = 0x2800;
const BRAILLE_MAX = 0x28ff;
// 入力待ちを示す静止グリフ。将来の仕様変更時はここに追記する。
const WAITING_GLYPHS = new Set(['✳']); // ✳
// claude 在席とみなすフォアグラウンドコマンド。
// 'node' は既知グリフを持つ場合のみ在席扱い（無関係な node アプリの誤検出回避）。
const CLAUDE_COMMANDS = new Set(['claude', 'node']);

function classifyGlyph(glyph: string): { known: boolean; working: boolean } {
  const code = glyph.codePointAt(0) ?? -1;
  const braille = code >= BRAILLE_MIN && code <= BRAILLE_MAX;
  const waiting = WAITING_GLYPHS.has(glyph);
  return { known: braille || waiting, working: braille };
}

/**
 * tmux の pane_current_command / pane_title から Claude の活動状態を判定する。
 * 在席でなければ undefined（= Claude無）。
 */
export function deriveClaudeStatus(
  command: string,
  title: string,
): ClaudeWindowStatus | undefined {
  const trimmed = title.replace(/^\s+/, '');
  const glyph = trimmed.charAt(0);
  const { known, working } = classifyGlyph(glyph);

  if (!CLAUDE_COMMANDS.has(command)) {
    return undefined; // claude / node 以外は対象外
  }
  const present = command === 'claude' || (command === 'node' && known);
  if (!present) {
    return undefined; // node だが既知グリフ無し等
  }

  const activity: ClaudeActivity = working ? 'working' : 'waiting';
  // 既知グリフはコードユニット 1 個（BMP）なので slice(1) で除去できる。
  const summary = (known ? trimmed.slice(1) : trimmed).trim();
  return summary ? { activity, summary } : { activity };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/claudePaneStatus.test.ts`
Expected: PASS（全 7 ケース）

- [ ] **Step 5: コミット**

```bash
git add packages/gateway/src/services/claudePaneStatus.ts packages/gateway/src/__tests__/services/claudePaneStatus.test.ts
git commit -m "feat(gateway): add deriveClaudeStatus glyph classifier"
```

---

## Task 3: 窓書式の拡張と `parseWindowLine` への付与

**Files:**
- Modify: `packages/gateway/src/services/tmux.ts`（`tmuxWindowListFormat` ~33行、`parseWindowLine` ~467行）
- Test: `packages/gateway/src/__tests__/services/tmux.test.ts`（既存に追記）

- [ ] **Step 1: 失敗するテストを追記**

`packages/gateway/src/__tests__/services/tmux.test.ts` に以下の describe を追記（ファイル先頭の `installExecMock` / `loadTmuxModule` ヘルパを利用）。`listWindows` は内部で `has-session`（sessionExists）→ `list-windows` を呼ぶので、両方に応答するハンドラを渡す。

```ts
describe('listWindows claudeStatus', () => {
  function installWindowsMock(windowsOutput: string): void {
    installExecMock((args) => {
      if (args[0] === 'has-session') return '';
      if (args[0] === 'list-windows') return windowsOutput;
      return '';
    });
  }

  it('アクティブペインの command/title から claudeStatus を付与する', async () => {
    // 書式: index|name|active|zoomed|panes|cwd|command|title
    installWindowsMock(
      '0|main|1|0|1|/home/server|claude|⠂ 作業概要\n' +
        '1|build|0|0|1|/home/server|zsh|server-Macmini',
    );
    const tmux = await loadTmuxModule();
    const windows = tmux.listWindows('zen_demo');
    const main = windows.find((w) => w.index === 0);
    const build = windows.find((w) => w.index === 1);
    expect(main?.claudeStatus).toEqual({ activity: 'working', summary: '作業概要' });
    expect(build?.claudeStatus).toBeUndefined();
  });

  it('title に | を含んでも末尾まで summary に取り込む', async () => {
    installWindowsMock('0|w|1|0|1|/home/server|claude|✳ a|b|c');
    const tmux = await loadTmuxModule();
    const w = tmux.listWindows('zen_demo')[0];
    expect(w.claudeStatus).toEqual({ activity: 'waiting', summary: 'a|b|c' });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/tmux.test.ts -t "claudeStatus"`
Expected: FAIL（現書式に command/title が無く `claudeStatus` が undefined）

- [ ] **Step 3: 実装する**

`packages/gateway/src/services/tmux.ts` の冒頭付近の import に追加:

```ts
import { deriveClaudeStatus } from './claudePaneStatus.js';
```

`tmuxWindowListFormat` を export + 末尾に command/title を追加（title は最後）:

```ts
export const tmuxWindowListFormat =
  '#{window_index}|#{window_name}|#{?window_active,1,0}|#{?window_zoomed_flag,1,0}|#{window_panes}|#{pane_current_path}|#{pane_current_command}|#{pane_title}';
```

`parseWindowLine` を export + command/title 解釈 + claudeStatus 付与に置き換え:

```ts
export function parseWindowLine(line: string): TmuxWindow | null {
  const parts = line.split('|');
  if (parts.length < 6) {
    return null;
  }
  const [indexRaw, name, activeRaw, zoomedRaw, panesRaw, cwd, command] = parts;
  const index = Number.parseInt(indexRaw, 10);
  const paneCount = Number.parseInt(panesRaw, 10);
  if (Number.isNaN(index) || Number.isNaN(paneCount)) {
    return null;
  }
  // pane_title は任意文字列（| を含み得る）。8 番目以降を再結合して復元する。
  const title = parts.slice(7).join('|');
  const window: TmuxWindow = {
    index,
    name,
    active: activeRaw === '1',
    zoomed: zoomedRaw === '1',
    paneCount,
    cwd: cwd || homeDir,
  };
  const claudeStatus = deriveClaudeStatus(command ?? '', title);
  if (claudeStatus) {
    window.claudeStatus = claudeStatus;
  }
  return window;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/tmux.test.ts`
Expected: PASS（新規 claudeStatus ケース + 既存ケースとも通る）

- [ ] **Step 5: コミット**

```bash
git add packages/gateway/src/services/tmux.ts packages/gateway/src/__tests__/services/tmux.test.ts
git commit -m "feat(gateway): enrich windows with claudeStatus from pane title"
```

---

## Task 4: `tmuxControlService.publish` の公開

**Files:**
- Modify: `packages/gateway/src/services/tmuxControl.ts`
- Test: `packages/gateway/src/__tests__/services/tmuxControl.test.ts`（既存に追記）

- [ ] **Step 1: 失敗するテストを追記**

`packages/gateway/src/__tests__/services/tmuxControl.test.ts` に追記:

```ts
import { tmuxControlService } from '../../services/tmuxControl.js';

describe('publish', () => {
  it('publish したイベントが購読者に届く', () => {
    const received: unknown[] = [];
    const unsubscribe = tmuxControlService.subscribe((e) => received.push(e));
    tmuxControlService.publish({ type: 'claude-status-changed' });
    unsubscribe();
    expect(received).toContainEqual({ type: 'claude-status-changed' });
  });
});
```

> 注: `subscribe` は最初の購読者で control mode を起動しようとするが、`node-pty.spawn` はテストでモック済み（既存 `tmuxControl.test.ts` の冒頭 mock を流用）。新ファイルではなく既存テストファイルに追記すること。

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/tmuxControl.test.ts -t "publish"`
Expected: FAIL（`publish` は未定義）

- [ ] **Step 3: 実装する**

`packages/gateway/src/services/tmuxControl.ts` の `TmuxControlService` クラスに public メソッドを追加（`subscribe` の直後あたり）:

```ts
  /** poller など外部から /ws/events 購読者へイベントを配信する */
  publish(event: TmuxEvent): void {
    this.emit(event);
  }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/tmuxControl.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/gateway/src/services/tmuxControl.ts packages/gateway/src/__tests__/services/tmuxControl.test.ts
git commit -m "feat(gateway): expose tmuxControlService.publish"
```

---

## Task 5: `claudeStatusPoller`

**Files:**
- Create: `packages/gateway/src/services/claudeStatusPoller.ts`
- Test: `packages/gateway/src/__tests__/services/claudeStatusPoller.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/gateway/src/__tests__/services/claudeStatusPoller.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  computeStatusSignature,
  ClaudeStatusPoller,
} from '../../services/claudeStatusPoller.js';

const FMT = (s: string) => s; // 可読性用

describe('computeStatusSignature', () => {
  // 行: session_name|index|name|active|zoomed|panes|cwd|command|title
  it('prefix 一致セッションのみ・activity を署名化（ソート安定）', () => {
    const out = [
      'zen_a|0|main|1|0|1|/h|claude|⠂ x',
      'zen_a|1|w|0|0|1|/h|zsh|server',
      '_zen_view_1|0|main|1|0|1|/h|claude|⠂ x', // prefix 不一致 → 除外
      'zen_b|0|m|1|0|1|/h|claude|✳ y',
    ].join('\n');
    expect(computeStatusSignature(out, 'zen_')).toBe(
      'zen_a/0:working,zen_a/1:none,zen_b/0:waiting',
    );
  });

  it('空出力 → 空署名', () => {
    expect(computeStatusSignature('', 'zen_')).toBe('');
  });
});

describe('ClaudeStatusPoller', () => {
  function make(outputs: string[]) {
    let i = 0;
    const publish = vi.fn();
    const runTmux = vi.fn(() => outputs[Math.min(i++, outputs.length - 1)]);
    const poller = new ClaudeStatusPoller({ runTmux, publish, intervalMs: 1000 });
    return { poller, publish, runTmux };
  }

  it('署名が変化した tick だけ publish する', () => {
    const { poller, publish } = make([
      'zen_a|0|m|1|0|1|/h|claude|⠂ x', // working
      'zen_a|0|m|1|0|1|/h|claude|⠂ x', // 同じ → publish しない
      'zen_a|0|m|1|0|1|/h|claude|✳ x', // waiting → publish
    ]);
    poller.tick();
    poller.tick();
    poller.tick();
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith({ type: 'claude-status-changed' });
  });

  it('runTmux が throw したら全 none 扱い（直前が非空なら 1 回 publish）', () => {
    const publish = vi.fn();
    let mode: 'ok' | 'throw' = 'ok';
    const runTmux = vi.fn(() => {
      if (mode === 'throw') throw new Error('no server');
      return 'zen_a|0|m|1|0|1|/h|claude|⠂ x';
    });
    const poller = new ClaudeStatusPoller({ runTmux, publish, intervalMs: 1000 });
    poller.tick(); // '' → working: publish 1
    mode = 'throw';
    poller.tick(); // working → '': publish 2
    poller.tick(); // '' → '': no publish
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('acquire でインターバル開始（即時 tick）、release で停止', () => {
    vi.useFakeTimers();
    const { poller, runTmux } = make(['zen_a|0|m|1|0|1|/h|zsh|x']);
    poller.acquire();
    expect(runTmux).toHaveBeenCalledTimes(1); // 即時 tick
    vi.advanceTimersByTime(2000);
    expect(runTmux).toHaveBeenCalledTimes(3); // +2 tick
    poller.release();
    vi.advanceTimersByTime(5000);
    expect(runTmux).toHaveBeenCalledTimes(3); // 停止後は増えない
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/claudeStatusPoller.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装する**

`packages/gateway/src/services/claudeStatusPoller.ts`:

```ts
import { execFileSync } from 'node:child_process';
import type { TmuxEvent } from '@zenterm/shared';
import { config } from '../config.js';
import { tmuxControlService } from './tmuxControl.js';
import { tmuxWindowListFormat, parseWindowLine } from './tmux.js';

const POLL_INTERVAL_MS =
  Number.parseInt(process.env.CLAUDE_STATUS_POLL_MS ?? '', 10) || 2000;

/**
 * `tmux list-windows -a`（session_name 前置）の出力から派生状態の signature を作る。
 * prefix 一致セッションのみ対象。tick ごとの比較に使う純関数。
 */
export function computeStatusSignature(output: string, sessionPrefix: string): string {
  const trimmed = output.trim();
  if (!trimmed) return '';
  return trimmed
    .split('\n')
    .map((line) => {
      const sep = line.indexOf('|');
      if (sep === -1) return null;
      const sessionName = line.slice(0, sep);
      if (!sessionName.startsWith(sessionPrefix)) return null;
      const win = parseWindowLine(line.slice(sep + 1));
      if (!win) return null;
      const activity = win.claudeStatus?.activity ?? 'none';
      return `${sessionName}/${win.index}:${activity}`;
    })
    .filter((v): v is string => v !== null)
    .sort()
    .join(',');
}

interface PollerDeps {
  runTmux: () => string;
  publish: (event: TmuxEvent) => void;
  intervalMs: number;
}

function defaultRunTmux(): string {
  return execFileSync(
    'tmux',
    ['list-windows', '-a', '-F', `#{session_name}|${tmuxWindowListFormat}`],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).toString();
}

export class ClaudeStatusPoller {
  private refCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private lastSignature = '';

  constructor(private readonly deps: PollerDeps) {}

  /** WS クライアント接続時に呼ぶ。最初の 1 人でインターバル開始 + 即時 tick。 */
  acquire(): void {
    this.refCount += 1;
    if (this.refCount === 1 && this.timer === null) {
      this.timer = setInterval(() => this.tick(), this.deps.intervalMs);
      this.tick();
    }
  }

  /** WS クライアント切断時に呼ぶ。最後の 1 人でインターバル停止。 */
  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.lastSignature = '';
    }
  }

  /** tmux を読み、signature が前回と変わっていれば 1 回だけ broadcast する。 */
  tick(): void {
    let signature = '';
    try {
      signature = computeStatusSignature(this.deps.runTmux(), config.SESSION_PREFIX);
    } catch {
      signature = ''; // tmux 不在等は全 none 扱い
    }
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.deps.publish({ type: 'claude-status-changed' });
    }
  }
}

export const claudeStatusPoller = new ClaudeStatusPoller({
  runTmux: defaultRunTmux,
  publish: (event) => tmuxControlService.publish(event),
  intervalMs: POLL_INTERVAL_MS,
});
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__/services/claudeStatusPoller.test.ts`
Expected: PASS（全 5 ケース）

- [ ] **Step 5: コミット**

```bash
git add packages/gateway/src/services/claudeStatusPoller.ts packages/gateway/src/__tests__/services/claudeStatusPoller.test.ts
git commit -m "feat(gateway): add claudeStatusPoller with signature-diff broadcast"
```

---

## Task 6: poller を events ルートに配線

**Files:**
- Modify: `packages/gateway/src/routes/events.ts`
- Test: `packages/gateway/src/__tests__/services/claudeStatusPoller.test.ts`（acquire/release のルート連動を別途確認するのは結合度が高いため、ここでは events ルートに薄く差し込み、poller 側の単体テスト（Task 5）でロジックを担保する）

- [ ] **Step 1: 実装する（ルートに acquire/release を差し込む）**

`packages/gateway/src/routes/events.ts` の import に追加:

```ts
import { claudeStatusPoller } from '../services/claudeStatusPoller.js';
```

`cleanup` 関数内（`unsubscribe` の後始末の近く）に release を追加:

```ts
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      claudeStatusPoller.release();
    };
```

`unsubscribe = tmuxControlService.subscribe(...)` の直後に acquire を追加:

```ts
    unsubscribe = tmuxControlService.subscribe((event) => {
      send(socket, event);
    });
    claudeStatusPoller.acquire();
```

> 注: 認証失敗時は `fail()` → `cleanup()` が走り release が呼ばれるが、その時点では未 acquire。`release()` は `Math.max(0, refCount-1)` で 0 を下回らないため安全。

- [ ] **Step 2: 既存の events 関連テストが壊れていないことを確認**

Run: `cd packages/gateway && npx vitest run src/__tests__`
Expected: PASS（全 gateway テスト。poller のインターバルは acquire 時のみ起動し、テストの WS 経路では node-pty/execFileSync がモックされるため副作用なし）

- [ ] **Step 3: 型チェック**

Run: `cd packages/gateway && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add packages/gateway/src/routes/events.ts
git commit -m "feat(gateway): drive claudeStatusPoller lifecycle from events ws"
```

---

## Task 7: i18n キー追加（8 言語）

**Files:**
- Modify: `packages/web/src/i18n/locales/{en,ja,de,es,fr,ko,pt-BR,zh-CN}.json`
- Test: `packages/web/src/i18n/__tests__/parity.test.ts`（既存・キー網羅を検証）

- [ ] **Step 1: 各ロケールの `sessions` オブジェクト内に `claudeStatus` を追加**

各ファイルの `"sessions": { ... }` の中（既存キーの隣）に以下を追加する。値は言語ごと:

- `en.json`:
```json
    "claudeStatus": { "working": "Working", "waiting": "Waiting for input" },
```
- `ja.json`:
```json
    "claudeStatus": { "working": "作業中", "waiting": "入力待ち" },
```
- `de.json`:
```json
    "claudeStatus": { "working": "Arbeitet", "waiting": "Wartet auf Eingabe" },
```
- `es.json`:
```json
    "claudeStatus": { "working": "Trabajando", "waiting": "Esperando entrada" },
```
- `fr.json`:
```json
    "claudeStatus": { "working": "En cours", "waiting": "En attente de saisie" },
```
- `ko.json`:
```json
    "claudeStatus": { "working": "작업 중", "waiting": "입력 대기 중" },
```
- `pt-BR.json`:
```json
    "claudeStatus": { "working": "Trabalhando", "waiting": "Aguardando entrada" },
```
- `zh-CN.json`:
```json
    "claudeStatus": { "working": "工作中", "waiting": "等待输入" },
```

> JSON の末尾カンマに注意。挿入位置の直前/直後のキーとの間に正しくカンマを置くこと。

- [ ] **Step 2: parity テストが通ることを確認**

Run: `cd packages/web && npx vitest run src/i18n/__tests__/parity.test.ts`
Expected: PASS（全言語が同一キー集合）

- [ ] **Step 3: コミット**

```bash
git add packages/web/src/i18n/locales
git commit -m "feat(web): add claudeStatus i18n keys for all locales"
```

---

## Task 8: `useEventsSubscription` で `claude-status-changed` を refetch

**Files:**
- Modify: `packages/web/src/hooks/useEventsSubscription.ts`
- Test: `packages/web/src/__tests__/flows/events-refetch-flow.test.tsx`（既存に追記）

- [ ] **Step 1: 失敗するテストを追記**

`events-refetch-flow.test.tsx` には既に「`windows-changed` を受けると `/api/sessions` を refetch する」テストがある。**その既存ケースをそのまま複製し、`onEvent` に渡す event type を `'windows-changed'` → `'claude-status-changed'` に差し替えるだけ**にする（認証セットアップ・listSessions スパイの取り回しを再発明せず、確実に同条件で検証するため）。

複製後の本体はおおむね次の形になる（refetch 検証の部分は既存ケースの assert をそのまま流用）:

```ts
act(() => {
  lastClientOptions!.onEvent({ type: 'claude-status-changed' });
});
```

> 既存に `windows-changed` の単独ケースが無く `sessions-changed` 等とまとめて検証している場合は、`claude-status-changed` を加えた 1 ケースを同じ assert スタイルで足す。

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/__tests__/flows/events-refetch-flow.test.tsx -t "claude-status-changed"`
Expected: FAIL（現状 `claude-status-changed` は refetch トリガに含まれない）

- [ ] **Step 3: 実装する**

`packages/web/src/hooks/useEventsSubscription.ts` の `onEvent` 内の条件に 1 行追加:

```ts
        if (
          event.type === 'sessions-changed' ||
          event.type === 'windows-changed' ||
          event.type === 'claude-status-changed' ||
          event.type === 'monitor-restart'
        ) {
          triggerRefetch();
        }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/web && npx vitest run src/__tests__/flows/events-refetch-flow.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/web/src/hooks/useEventsSubscription.ts packages/web/src/__tests__/flows/events-refetch-flow.test.tsx
git commit -m "feat(web): refetch sessions on claude-status-changed"
```

---

## Task 9: `ClaudeStatusBadge` コンポーネント

**Files:**
- Create: `packages/web/src/components/sidebar/ClaudeStatusBadge.tsx`
- Modify: `packages/web/src/index.css`（keyframes）
- Test: `packages/web/src/components/sidebar/__tests__/ClaudeStatusBadge.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`packages/web/src/components/sidebar/__tests__/ClaudeStatusBadge.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaudeStatusBadge } from '../ClaudeStatusBadge';

describe('ClaudeStatusBadge', () => {
  it('working: aria-label と summary 付きツールチップ', () => {
    render(<ClaudeStatusBadge status={{ activity: 'working', summary: 'XT5処理' }} />);
    const el = screen.getByRole('img');
    expect(el).toHaveAttribute('aria-label', 'Working');
    expect(el).toHaveAttribute('title', 'Working · XT5処理');
  });

  it('waiting: summary 無しならツールチップは状態のみ', () => {
    render(<ClaudeStatusBadge status={{ activity: 'waiting' }} />);
    const el = screen.getByRole('img');
    expect(el).toHaveAttribute('aria-label', 'Waiting for input');
    expect(el).toHaveAttribute('title', 'Waiting for input');
  });
});
```

> Web テストは `setupTests.ts` で i18n を **`lng: 'en'` 固定**で初期化している。よって期待文字列は英語（`sessions.claudeStatus.working`='Working' / `waiting`='Waiting for input'）。

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/components/sidebar/__tests__/ClaudeStatusBadge.test.tsx`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 3: 実装する**

`packages/web/src/components/sidebar/ClaudeStatusBadge.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import type { ClaudeWindowStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';

export interface ClaudeStatusBadgeProps {
  status: ClaudeWindowStatus;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ClaudeStatusBadge({ status }: ClaudeStatusBadgeProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const isWorking = status.activity === 'working';
  const label = t(`sessions.claudeStatus.${status.activity}`);
  const tooltip = status.summary ? `${label} · ${status.summary}` : label;
  const color = isWorking ? tokens.colors.warning : tokens.colors.success;
  const animate = isWorking && !prefersReducedMotion();

  return (
    <span
      role="img"
      aria-label={label}
      title={tooltip}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: 8,
        height: 8,
        borderRadius: '50%',
        boxSizing: 'border-box',
        // working = 塗りドット + 鼓動 / waiting = リング(中空) + 静止
        background: isWorking ? color : 'transparent',
        border: isWorking ? 'none' : `2px solid ${color}`,
        animation: animate ? 'zen-status-pulse 1.6s ease-in-out infinite' : undefined,
      }}
    />
  );
}
```

`packages/web/src/index.css` の末尾に keyframes を追加:

```css
@keyframes zen-status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.78); }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/web && npx vitest run src/components/sidebar/__tests__/ClaudeStatusBadge.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/web/src/components/sidebar/ClaudeStatusBadge.tsx packages/web/src/components/sidebar/__tests__/ClaudeStatusBadge.test.tsx packages/web/src/index.css
git commit -m "feat(web): add ClaudeStatusBadge component"
```

---

## Task 10: `WindowRow` にバッジ枠を挿入

**Files:**
- Modify: `packages/web/src/components/sidebar/WindowRow.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx`（無ければ新規）

- [ ] **Step 1: 失敗するテストを書く**

`packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx`（既存があれば describe を追記）:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TmuxWindow } from '@zenterm/shared';
import { WindowRow } from '../WindowRow';

const baseWindow: TmuxWindow = {
  index: 0,
  name: 'main',
  active: false,
  zoomed: false,
  paneCount: 1,
  cwd: '/home/server',
};

function renderRow(window: TmuxWindow) {
  return render(
    <WindowRow
      sessionDisplayName="demo"
      window={window}
      isActive={false}
      openInPaneOptions={[]}
      onSelect={vi.fn()}
      onRename={vi.fn()}
      onRequestDelete={vi.fn()}
      onOpenInPane={vi.fn()}
    />,
  );
}

describe('WindowRow claudeStatus', () => {
  it('claudeStatus があるとバッジを描画する', () => {
    renderRow({ ...baseWindow, claudeStatus: { activity: 'waiting' } });
    expect(screen.getByRole('img', { name: 'Waiting for input' })).toBeInTheDocument();
  });

  it('claudeStatus が無ければバッジを描画しない', () => {
    renderRow(baseWindow);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/components/sidebar/__tests__/WindowRow.test.tsx`
Expected: FAIL（バッジ未挿入）

- [ ] **Step 3: 実装する**

`packages/web/src/components/sidebar/WindowRow.tsx` の import に追加:

```ts
import { ClaudeStatusBadge } from './ClaudeStatusBadge';
```

外側 `<div ... style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>` の**最初の子**として、行頭にバッジ枠を挿入（claudeStatus が無くてもレイアウトを揃えるため固定幅の枠を確保）:

```tsx
      <span
        aria-hidden={window.claudeStatus ? undefined : true}
        style={{
          width: 8,
          marginRight: tokens.spacing.xs,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {window.claudeStatus ? <ClaudeStatusBadge status={window.claudeStatus} /> : null}
      </span>
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/web && npx vitest run src/components/sidebar/__tests__/WindowRow.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/web/src/components/sidebar/WindowRow.tsx packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx
git commit -m "feat(web): show Claude status badge in window rows"
```

---

## Task 11: 全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: gateway 全テスト + 型チェック**

Run: `cd packages/gateway && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS / 型エラーなし

- [ ] **Step 2: web 全テスト + 型チェック**

Run: `cd packages/web && npx vitest run && npx tsc --noEmit`
Expected: 全 PASS / 型エラーなし

- [ ] **Step 3: gateway ビルド（web bundle 同梱までは不要、tsc が通ればよい）**

Run: `cd packages/gateway && npm run build`
Expected: 成功

- [ ] **Step 4: （任意）実機での目視確認**

`scripts/dev-docker.sh` で container 内 gateway を起動し、host ブラウザ（ポート 18766）で接続。container 内に `claude` という名前のスタブ（`printf '\033]2;⠂ test\033\\'; sleep 600` 等）を tmux ペインで起動し、セッション一覧のウィンドウ行にバッジが出てリアルタイム更新されることを確認。
> 本番機の実 tmux に対する E2E は禁止（CLAUDE.md の tmux 分離ルール）。必ず Docker 隔離経由で。

- [ ] **Step 5: 仕上げ**

`superpowers:finishing-a-development-branch` スキルでマージ/PR を判断する。

---

## 既知の制限（設計書 §8 より再掲）
- 分割ウィンドウの**非アクティブペイン**で動く Claude は検出しない（アクティブペインのみ）。
- Claude Code が将来スピナー/待機グリフ仕様を変えると判定が壊れ得る（`claudePaneStatus.ts` の定数で追従）。
- セッション折りたたみ時はバッジが見えない（ウィンドウ個別表示のみ。ロールアップは将来拡張）。
