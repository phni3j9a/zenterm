# Codex CLI レート制限を ZenTerm に表示する (experimental)

> **これは experimental 機能です。**
> Codex CLI が書くセッションログ (`~/.codex/sessions/`) を ZenTerm Gateway が直接読み取って表示します。
> Codex 側の内部フォーマット (`event_msg` の `token_count` イベント) に依存するため、Codex のアップデートで構造が変わると一時的に表示されなくなる可能性があります。

**仕様の裏取り用リンク:**
- ZenTerm リポジトリ: https://github.com/phni3j9a/zenterm
- Gateway 読み込みロジック: [`server/packages/gateway/src/services/codexStatus.ts`](https://github.com/phni3j9a/zenterm/blob/main/server/packages/gateway/src/services/codexStatus.ts)
- 参考にした実装 (Codex 側のフィールド構造): [K9i-0/ccpocket](https://github.com/K9i-0/ccpocket/blob/main/packages/bridge/src/usage.ts)

---

## ユーザー側のセットアップは不要

Claude Code 連携 (`docs/claude-statusline.md`) と違い、Codex 側は **何も設置しなくて OK** です。
Codex CLI を 1 度でも起動するだけで `~/.codex/sessions/YYYY/MM/DD/<id>.jsonl` にイベントログが書かれ、ZenTerm Gateway が `GET /api/codex/limits` のたびにこのログを読みに行きます。

```
[Codex CLI を起動するだけ]
  └─ ~/.codex/sessions/YYYY/MM/DD/<id>.jsonl が更新される (token_count イベント追記)
       └─ ZenTerm Gateway が直近 7 日のセッションを mtime 新しい順に走査し、
           最新の token_count + rate_limits を抽出
            └─ ZenTerm の Web/Mobile UI が更新ボタン押下時に取得して表示
```

抽出している情報:

| ZenTerm UI 表示 | Codex jsonl 内のフィールド |
|---|---|
| 5h ウィンドウの使用率/リセット時刻 | `payload.rate_limits.primary` (`window_minutes: 300`) |
| 7d ウィンドウの使用率/リセット時刻 | `payload.rate_limits.secondary` (`window_minutes: 10080`) |
| プラン名 (Plus / Pro 等) | `payload.rate_limits.plan_type` |
| 取得時刻 | `timestamp` (ISO8601 → Unix sec に変換) |

5 分以上前の token_count しか無ければ `stale` 表示になります (Codex はユーザー操作のたびに新しい token_count を吐くため、ZenTerm 側は 5 分超過を「直前の値かも」フラグにしている)。

## 出力ファイルの確認 (必要なら)

```bash
# 最新セッションファイル
ls -lt ~/.codex/sessions/*/*/*/*.jsonl | head -3

# 最新の rate_limits イベントだけ抜き出す
grep -h token_count ~/.codex/sessions/*/*/*/*.jsonl | tail -1 | jq '.payload.rate_limits'
```

## トラブルシューティング

| ZenTerm UI の表示 | 原因 / 対処 |
|---|---|
| `unconfigured` | `~/.codex` ディレクトリがない (Codex CLI 未インストール / 一度も起動していない)。`codex` を 1 回起動 |
| `pending` | 過去 7 日間にセッションファイルが無い、または rate_limits 情報がまだ含まれていない。Codex で何か質問してみる |
| `unavailable: read_error` | `~/.codex/sessions` の権限不足 / ファイル破損。Gateway を実行しているユーザーで読めるか `ls` で確認 |
| `stale` (古いデータ) | Codex を最近使っていない (5 分以上前の token_count しか無い)。最新の状況を見るには Codex で何かリクエストしてから更新ボタン |

## 仕様メモ

- ZenTerm Gateway は `~/.codex/` を **一切編集しません**。読み取りのみ
- ファイル監視も行いません (ポーリングなし、`GET /api/codex/limits` 呼び出し時に毎回 on-demand 読み込み)
- 1 アカウント前提 (`~/.codex` 直接読み)。複数の OpenAI アカウントを `CODEX_HOME` で切り替えている場合の対応は将来追加予定
- Codex CLI のセッション JSONL フォーマットは公式に文書化されていない内部実装。互換性は保証されない
