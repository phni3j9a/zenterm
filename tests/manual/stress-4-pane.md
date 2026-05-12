# 4 ペイン同時稼働ストレステスト (Phase 5b Task C11)

## 環境
- Mac mini 2018 (i5-8500B / 32GB RAM / Ubuntu 24.04 LTS t2linux)
- Chrome 132+ / Firefox 122+ / Safari 17+ のいずれか
- DevTools Memory + Performance + Network タブを準備

## 手順

1. Gateway 起動: `npm run dev:gateway` (もしくは systemd unit)
2. Web dev: `cd packages/web && npm run dev`
3. ブラウザで `/web/sessions` を開き login (token: AUTH_TOKEN)
4. Settings → Theme → dark に揃える
5. 別ターミナルで stress script 起動:
   ```bash
   cd /home/server/projects/zenterm/server
   npm run stress:web   # scripts/stress/spawn-yes.sh
   ```
6. Web UI 側: layout を `grid-2x2` に変更
7. 4 ペインそれぞれに stress セッション (`zen_stress_1` 〜 `zen_stress_4`) を割当
8. DevTools の Memory タブで Heap snapshot を 0s / 30s / 60s で取る
9. Performance タブで 10 秒 Record (yes 出力中)
10. Network → WS タブで bytes/sec を確認

## 計測項目

| 項目 | 期待値 | 実測 |
|---|---|---|
| JS Heap (60s) | < 200MB | ___ MB |
| DOM nodes (60s) | < 5000 (xterm scrollback 5000 上限) | ___ |
| WS frames/sec (combined 4 panes) | < 200 fps (Gateway batching 効くため) | ___ |
| メインスレッド占有率 | < 40% | ___ % |
| 60 秒後の UI 応答性 | Sidebar drag / Tab 切替が < 100ms で反応 | ___ |
| ペインの xterm.buffer.active.length | 5000 で頭打ち | ___ |

> **WS frames/sec の測り方**: DevTools Network → WS タブでは fps が直接表示されないため、5 秒間に観測されたフレーム数を数えて 5 で割る。または以下を DevTools Console で実行して件数を取得:
> ```js
> performance.getEntriesByType('resource').filter(r => r.name.startsWith('ws://') || r.name.startsWith('wss://'))
> ```

## Pass 条件

- 60 秒間 OOM crash しない
- 上記表の値が全て期待値内
- 終了後、Sidebar tab 切替・新規セッション作成が引き続き動作する

## Fail 時の対応

- Heap > 200MB → xterm scrollback を 3000 に下げて再計測 (`XtermView.tsx` の `scrollback: 5000` 修正)
- WS frames > 200/s → Gateway 側で batching window を 50ms → 100ms に拡大検討 (本タスクのスコープ外、別 issue 化)
- メインスレッド > 40% → fit/render の追加 debounce を検討

## ログ保存先

DevTools の Performance recording を export し、`tests/manual/recordings/stress-YYYY-MM-DD.json` に保存 (gitignore 推奨)。
