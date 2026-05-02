# Claude Code レート制限を ZenTerm に表示する (experimental)

> **これは experimental 機能です。**
> Claude Code は rate_limits 情報を statusline JSON 経由でしか公式に出していません。
> ZenTerm は `~/.claude/` を一切編集しない方針で運用しているため、連携の設置は **ユーザー自身の責任** で行います。
> 公式 API が出るまでの暫定的な仕組みであることをご理解の上ご利用ください。

---

## 全体の仕組み

```
[Claude Code]
  └─ statusLine 起動時に rate_limits を含む JSON を stdin で statusLine.command に流す
       └─ ZenTerm 連携処理が JSON を抽出してファイルに書き出し
            └─ ~/.config/zenterm/claude-status.json (アトミック書き込み)
                 └─ ZenTerm Gateway (port 18765) が GET /api/claude/limits 受信時に
                    on-demand で読み、zod 検証 + stale 計算 + discriminated union で返す
                      └─ ZenTerm の Web/Mobile UI が更新ボタン押下時に取得して表示
```

ZenTerm Gateway は **既に動いています**。ユーザーが整備するのは「**Claude Code から JSON ファイルを書き出す部分**」のみです。

---

## 推奨セットアップ: あなたの Claude Code に丸投げする

`~/.claude/settings.json` の `statusLine` 設定や、既に使っている statusline スクリプト (ccstatusline / claude-powerline / 自前 Python / 何もなし、等) は人によって全然違います。**ZenTerm 側で網羅的にケースを書くより、あなた自身の Claude Code セッションに環境を読ませて、適切な実装を自動でやってもらう方が確実かつ安全** です。

### 手順

1. `claude` を起動 (or 既に開いているセッションを使う)
2. 下のプロンプトをコピーして、そのまま貼り付ける
3. Claude Code が現在の環境を読んで、適切な連携実装を提案・実行
4. ZenTerm の Web / Mobile アプリで動作確認

### コピペ用プロンプト

````
# ZenTerm × Claude Code 連携 (experimental)

ZenTerm Gateway (この PC で稼働) に Claude Code の rate_limits を渡す連携を、
私の現在の環境に合わせて実装してください。

## 全体の仕組み

[Claude Code]
  └─ statusLine 起動時に rate_limits 等を含む JSON を stdin で statusLine.command に流す
       └─ ZenTerm 連携処理が JSON を抜き出して書き出し
            └─ ~/.config/zenterm/claude-status.json (アトミック書き込み)
                 └─ ZenTerm Gateway (port 18765) が GET /api/claude/limits 受信時に
                    on-demand で読み、zod 検証 + stale 計算 + discriminated union で返す
                      └─ ZenTerm の Web/Mobile UI が定期的にバーで表示

## 私が実装すべき範囲

上記の「ZenTerm 連携処理が JSON を抜き出して書き出し」の部分だけ。Gateway 側は既に
動いているので触る必要なし。

## 出力契約 (Gateway が期待する形)

ファイル: ${XDG_CONFIG_HOME:-~/.config}/zenterm/claude-status.json
書き込み方式: tmp + rename によるアトミック更新 (POSIX rename(2) 保証)

スキーマ:
{
  "schema_version": 1,
  "captured_at": <unix epoch sec>,
  "five_hour": { "used_percentage": <0-100>, "resets_at": <unix epoch sec> } | null,
  "seven_day": { "used_percentage": <0-100>, "resets_at": <unix epoch sec> } | null
}

備考:
- five_hour / seven_day は欠落許容: Claude Pro/Max 以外、もしくはセッション内で初回 API
  レスポンスを受け取る前は rate_limits フィールド自体が無い
- captured_at は書き出し時の現在時刻 (Unix 秒)。Gateway はこれと現在時刻の差で stale を
  判定する (差 > 300 秒 で stale: true)

## データソース (statusLine が私 (Claude Code) に渡してくれる JSON)

公式仕様: https://code.claude.com/docs/en/statusline

抜き出すべきフィールド:
{
  "rate_limits": {
    "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 },
    "seven_day": { "used_percentage": 41.2, "resets_at": 1738857600 }
  }
}

`rate_limits` フィールド自体が無い場合は five_hour / seven_day を null にして書き出す。
そうすると Gateway 側で state="pending" になり「初回 API 前」として扱われる。

## Gateway のレスポンス (理解の助けに)

GET /api/claude/limits は常に HTTP 200 を返し、ボディは以下の discriminated union:

| state | 条件 |
|---|---|
| `unconfigured` | claude-status.json が存在しない (ENOENT) |
| `unavailable` | ファイルはあるが JSON パース失敗 / スキーマ違反 |
| `pending` | ファイルは妥当だが five_hour も seven_day も null |
| `ok` | 少なくとも片方の窓に値がある |

`ok` / `pending` には `ageSeconds` と `stale` (`ageSeconds > 300`) が付く。

## 制約 (厳守)

1. 私の既存 statusline 表示を一切壊さない
2. ~/.claude/settings.json の他キー (env / hooks / permissions / enabledPlugins /
   extraKnownMarketplaces 等) を絶対に消さない
3. settings.json を編集する場合は事前にタイムスタンプ付きバックアップを取る
4. ZenTerm 連携の書き出し失敗が statusline 本来の動作を壊さないよう try/catch で吸収する
5. 私のシェルやエディタが settings.json を開いている可能性を考え、書き換え前に状態確認

## 私の現状把握のために見て欲しい

- ~/.claude/settings.json の statusLine 設定
- statusLine.command が指すスクリプトの中身 (自前なら拡張余地、npm パッケージなら wrapper 検討)
- 利用可能なツール (jq / python3 / node)

## 実装後の検証

1. cat ~/.config/zenterm/claude-status.json でスキーマ通りに書かれているか確認
2. (Gateway の AUTH_TOKEN を私が渡せるなら) curl で /api/claude/limits を叩いて
   state が "ok" or "pending" になることを確認
3. ZenTerm Web/Mobile UI で更新ボタンを押して反映を確認

## ロールバック

問題があればバックアップから settings.json を復元し、追加スクリプトを削除すれば
クリーンに戻ります。
````

---

## 手動セットアップ (Claude Code に任せたくない場合)

> 以下は推奨経路ではなく、自分で試行錯誤したい人向けの参考情報です。**自己責任** で。

### A. statusline をまだ何も使っていない場合

下のブロックをターミナルにそのまま貼り付けて Enter:

```bash
mkdir -p ~/.config/zenterm && cat > ~/.config/zenterm/statusline.sh <<'ZENTERM_STATUSLINE_EOF' && chmod +x ~/.config/zenterm/statusline.sh
#!/usr/bin/env bash
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

exit 0
ZENTERM_STATUSLINE_EOF
```

その後、`~/.claude/settings.json` に **自分で** 以下を追記 (他のキーは絶対に消さない):

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.config/zenterm/statusline.sh"
  }
}
```

### B. 既に statusline を使っている場合

統合は環境依存度が高く、以下のような落とし穴があります:

- 既存スクリプトが stdin を1度しか読めないと wrapper と取り合いになる
- `ccstatusline` / `claude-powerline` 等の npm パッケージは更新で実体パスが変わる
- `jq` / `python3` / `node` が無い環境ではスニペットが動かない
- `XDG_CONFIG_HOME` の有無で書き出し先がぶれる
- stderr が混入すると statusline 表示が乱れる

これらを安全に処理するには、上の「推奨セットアップ」のプロンプトを Claude Code に渡す方がはるかに確実です。

---

## 出力ファイルの確認

セットアップ後、Claude Code に何かメッセージを送ってから:

```bash
cat ~/.config/zenterm/claude-status.json
```

期待する例:

```json
{
  "schema_version": 1,
  "captured_at": 1714377600,
  "five_hour": { "used_percentage": 23.5, "resets_at": 1714395600 },
  "seven_day": { "used_percentage": 41.2, "resets_at": 1714809600 }
}
```

## トラブルシューティング

| ZenTerm UI の表示 | 原因 / 対処 |
|---|---|
| `unconfigured` のまま | ファイル未生成。スクリプト未配置 or `statusLine.command` 未設定。Claude Code を1回起動・1メッセージ送って確認 |
| `pending` のまま | Claude Pro/Max でない、または初回 API レスポンス未取得。`claude` で何か質問してみる |
| `unavailable: malformed` | jq 未インストール、または手動で書いたファイルが壊れている。`cat` で中身確認 |
| `stale` (古いデータ) | Claude Code がアイドル。再度メッセージを送ると captured_at が更新される |

## 仕様メモ

- ZenTerm Gateway は `~/.claude/` を **一切編集しません**。ファイル監視も行いません (ポーリングなし、`GET /api/claude/limits` 呼び出し時に毎回 on-demand 読み込み)
- ファイル書き込みは tmp + rename でアトミック (POSIX `rename(2)` 保証) なので部分書き込みは reader 側に見えません
- `schema_version: 1` を維持。将来不互換変更があれば 2 以降に bump
