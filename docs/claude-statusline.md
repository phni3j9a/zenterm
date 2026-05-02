# Claude Code レート制限を ZenTerm に表示する

ZenTerm は Claude Code の statusline 機構を経由して、5時間 / 週次のレート制限を取得します。
**ZenTerm 自身は `~/.claude/` 以下を一切変更しません。** ユーザーが `~/.claude/settings.json`
に下記スクリプトを登録することで連携が始まります。

## 前提

- Claude Code 2.x 以降 (statusline JSON に `rate_limits` が含まれるバージョン)
- Claude Pro / Max プラン (無料/従量プランでは `rate_limits` が出ない)
- セッション内で **少なくとも 1 回 API リクエストを実行済み** であること
  (初回 API レスポンスが返るまで `rate_limits` フィールドは現れない)
- `jq` が利用可能なこと (`apt install jq` / `brew install jq`)

## セットアップ手順

### 1. statusline スクリプトを設置

ターミナルに **下のブロック全体をそのまま貼り付けて Enter** すれば、`~/.config/zenterm/statusline.sh` が作成され実行権限も付きます。

```bash
mkdir -p ~/.config/zenterm && cat > ~/.config/zenterm/statusline.sh <<'ZENTERM_STATUSLINE_EOF' && chmod +x ~/.config/zenterm/statusline.sh
#!/usr/bin/env bash
# ZenTerm 連携 statusline。
# Claude Code が stdin に流す JSON から rate_limits を抜き出し、
# ~/.config/zenterm/claude-status.json にアトミック書き込みする。
# 標準出力には何も出さない (空 statusline)。
# 既存の statusline を維持したい場合は最終行の echo に元の表示を入れる。

set -u
INPUT="$(cat)"

OUT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zenterm"
OUT_FILE="$OUT_DIR/claude-status.json"
TMP_FILE="$(mktemp "$OUT_DIR/claude-status.XXXXXX.json" 2>/dev/null || true)"

mkdir -p "$OUT_DIR"
[ -z "$TMP_FILE" ] && TMP_FILE="$(mktemp "$OUT_DIR/claude-status.XXXXXX.json")"

NOW="$(date +%s)"

printf '%s' "$INPUT" | jq --argjson now "$NOW" '{
  schema_version: 1,
  captured_at: $now,
  five_hour: (.rate_limits.five_hour // null
    | if . == null then null
      else { used_percentage: .used_percentage, resets_at: .resets_at } end),
  seven_day: (.rate_limits.seven_day // null
    | if . == null then null
      else { used_percentage: .used_percentage, resets_at: .resets_at } end)
}' > "$TMP_FILE" 2>/dev/null && mv -f "$TMP_FILE" "$OUT_FILE" || rm -f "$TMP_FILE"

# 既存 statusline を保ちたい場合はここで元の表示を echo
exit 0
ZENTERM_STATUSLINE_EOF
```

ヒアドキュメント終端 (`ZENTERM_STATUSLINE_EOF`) はシングルクオート付きなので、`$INPUT` や `$NOW` 等のシェル変数はファイル書き込み時点では展開されず、スクリプト内に文字列として保存されます。

### 2. `~/.claude/settings.json` に登録

既存の設定を **絶対に上書きしないよう注意**。`statusLine` キーだけ追記する。

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.config/zenterm/statusline.sh"
  }
}
```

既に `statusLine` を使っている場合は、既存スクリプトを呼んだ結果を `echo` してから上記処理を行う wrapper を作る。

### 3. Claude Code を起動して 1 メッセージ送る

`claude` を起動し、何でもいいので 1 メッセージ送信。
レスポンス受信後、`~/.config/zenterm/claude-status.json` が作成される。

```bash
cat ~/.config/zenterm/claude-status.json
```

例:

```json
{
  "schema_version": 1,
  "captured_at": 1714377600,
  "five_hour": { "used_percentage": 23.5, "resets_at": 1714395600 },
  "seven_day": { "used_percentage": 41.2, "resets_at": 1714809600 }
}
```

### 4. ZenTerm 側で確認

ZenTerm Web / アプリの「Claude」カードで更新ボタンを押すとバーが表示される。

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| `unconfigured` 表示のまま | スクリプト未配置、または `settings.json` に `statusLine` 未登録 |
| `pending` 表示のまま | Claude Pro/Max でない、または初回 API レスポンス未取得。`claude` で何か聞いてみる |
| `unavailable: malformed` | `jq` 未インストール、または手動でファイルを破損させた可能性 |
| `stale` (古い) のままになる | Claude Code がアイドル状態。Claude に再度メッセージを送ると `captured_at` が更新される |

## 仕様

- 出力ファイル: `${XDG_CONFIG_HOME:-~/.config}/zenterm/claude-status.json`
- 書き込み: tmp + `mv -f` でアトミック (POSIX `rename(2)` 保証)
- スキーマバージョン: `schema_version: 1`
- ZenTerm Gateway は `GET /api/claude/limits` で読み込み、5 分超過で `stale: true` を返す
