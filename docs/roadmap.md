# ZenTerm Browser Rebuild

## Status: 完了 (2026-05-13 web-pc-phase-7-done)

Phase 1〜7 全て main にマージ済。タグ: `web-pc-phase-{1, 2a, 2b, 2c, 2d, 3, 4a, 4b, 5a, 5b, 6, 7}-done`

| Phase | 主な成果 | 完了日 |
|-------|----------|--------|
| 1     | Web 基盤 (ターミナル, セッション管理, 自動再接続)                                      | 2026-05-07 |
| 2a-d  | UX 磨き込み (キーボード, 検索, コピペ, テーマ)                                         | 2026-05-08〜09 |
| 3     | ペイン分割 (4 ペイン, tmux 連携)                                                        | 2026-05-10 |
| 4a-b  | ファイルマネージャ (CRUD, プレビュー, アップロード, ContextMenu)                       | 2026-05-10 |
| 5a-b  | i18n 8 言語 + ディープリンク + a11y axe-core + iPad 互換 + Tooltip + ContextMenu 共通化 | 2026-05-11〜12 |
| 6     | UI/UX 仕上げ (共通プリミティブ 7 件, lucide-react, LeftRail, EmptyState, Onboarding, focus-ring) | 2026-05-12 |
| 7     | Docker 隔離 e2e 基盤 (`scripts/e2e-docker.sh` / `scripts/dev-docker.sh` / `Dockerfile.e2e`)  | 2026-05-13 |

> 最終更新: 2026-05-13

旧 `packages/web` 実装は削除済 (Phase 0 直前)。Phase 1 以降で完全に作り直し。
Gateway API と `/embed/terminal` の互換性は壊さず、モバイルアプリへの影響なし。

## 配信物 (Gateway public/)

- `/`                  ランディングページ
- `/support.html`      サポートページ
- `/lp/*`              ランディングページ用アセット
- `/embed/terminal`    モバイルアプリ WebView 用ターミナル (Phase 0 から変わらず)
- `/terminal/lib/*`    モバイル WebView 用 xterm.js アセット
- `/web/*`             PC ブラウザ向け SPA (Phase 1〜7 で構築、`packages/web` をビルドして同梱)

## Phase 7 の意義

Phase 6 完了時点の e2e 実行は host 上で `npx playwright test` を直接叩く方式だった。
これは gateway の `execFileSync('tmux', args)`（`-L`/`-S` 非指定）の構造的制約により、
playwright が SIGKILL や panic で落ちた瞬間に host の tmux セッション
(例: `_zen_monitor`) ごと巻き添えで死ぬ事故を繰り返し起こした。

`HOME` だけ分離する `mkdtempSync` パターン、`TMUX_TMPDIR` を別ディレクトリにする
パターン、いずれも `$TMUX` 環境変数の継承や Node `child_process` の env マージで
漏れることが分かり、対症療法 (band-aid) の積み重ねでは根治しないと判断。

**Phase 7 では Docker container を導入し、PID/mount/network namespace で host から
gateway 配下のすべてのプロセスを構造的に切り離した。**

- `Dockerfile.e2e`     : `mcr.microsoft.com/playwright:v1.58.2-noble` ベース、tmux + node-pty toolchain 同梱
- `scripts/e2e-docker.sh`: 全 49 spec を container 内 chromium で走らせる
- `scripts/dev-docker.sh`: 開発用 gateway を container 内で起動、host ブラウザから接続
- container 内 tmux socket は tmpfs `/tmp` に閉じ込められ host から到達不能

Phase 7 完了時点で、8 分超の e2e 全走を経ても host `tmux ls` の出力は 1 文字も変わら
ないことを確認 (前後で session ID と作成タイムスタンプが完全一致)。

## 既知の課題 / 将来検討

- **#244 (E3) gateway `-L`/`-S` socket 化**: container 隔離で実害は消えたが、
  gateway 自体に socket isolation を入れるべきかは別議論。Docker なしで host 上で
  e2e を回したいケース (ローカル CI なしの個人開発) が出てきたら再検討。
- **E2E 並列度の最適化**: Phase 7 では `playwright.config.ts` に `retries: 1` を入れた
  (Docker 内 chromium が時々 SIGSEGV、Phase 7 commit 39e2b8d を参照)。GPU 有効化や
  worker 数調整で改善できるか別途調査余地あり。
