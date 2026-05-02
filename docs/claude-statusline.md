# Claude Code レート制限を ZenTerm に表示する (experimental)

> **これは experimental 機能です。**
> Claude Code は rate_limits 情報を statusline JSON 経由でしか公式に出していません。
> ZenTerm は `~/.claude/` を一切編集しない方針で運用しているため、連携の設置は **ユーザー自身の責任** で行います。
> 公式 API が出るまでの暫定的な仕組みであることをご理解の上ご利用ください。

---

## 全体の仕組み

```
[Claude Code (1 個 or 複数アカウント並行)]
  └─ statusLine 起動時に rate_limits を含む JSON を stdin で statusLine.command に流す
       └─ ZenTerm 連携処理が JSON を抽出してファイルに書き出し
            ├─ 単一アカウント: ~/.config/zenterm/claude-status.json
            └─ 複数アカウント: ~/.config/zenterm/claude-status/<label>.json (アカウントごとに別ファイル)
                 └─ ZenTerm Gateway (port 18765) が GET /api/claude/limits 受信時に
                    on-demand で全ファイルを読み、zod 検証 + stale 計算 + アカウント配列で返す
                      └─ ZenTerm の Web/Mobile UI が更新ボタン押下時に取得して表示
```

ZenTerm Gateway は **既に動いています**。ユーザーが整備するのは「**Claude Code から JSON ファイルを書き出す部分**」のみです。

複数の Anthropic アカウント (例: `claude` と `CLAUDE_CONFIG_DIR=~/.claude-sub claude`) を並行運用している場合は、**アカウントごとに別ファイル** に書き出す必要があります (同じファイルだと最後に書いた方が勝ってしまうため)。

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

書き込み先 (どちらか / 両方):
- 単一アカウント: ${XDG_CONFIG_HOME:-~/.config}/zenterm/claude-status.json
- 複数アカウント: ${XDG_CONFIG_HOME:-~/.config}/zenterm/claude-status/<label>.json
  (例: main.json, sub.json)

書き込み方式: tmp + rename によるアトミック更新 (POSIX rename(2) 保証)

スキーマ:
{
  "schema_version": 1,
  "captured_at": <unix epoch sec>,
  "five_hour": { "used_percentage": <0-100>, "resets_at": <unix epoch sec> } | null,
  "seven_day": { "used_percentage": <0-100>, "resets_at": <unix epoch sec> } | null,
  "label": "<UI 表示用の任意文字列>"  // 省略可。省略時はファイル名 stem が label になる
}

複数アカウント運用 (重要):
- Claude のアカウントが複数 (例: 通常 ~/.claude/ と CLAUDE_CONFIG_DIR=~/.claude-sub) の場合、
  それぞれの statusline 連携処理は **CLAUDE_CONFIG_DIR ごとに違うファイル** に書き出すこと
- ファイル名は識別しやすいもので OK (main.json / sub.json / 自分で md5(CLAUDE_CONFIG_DIR) など)
- JSON 内の "label" フィールドに UI 表示名を指定できる (省略時はファイル名 stem)

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

GET /api/claude/limits は常に HTTP 200 を返し、ボディは以下の形:

- ファイルが一切存在しなければ: `{ state: "unconfigured" }`
- 1 個以上ファイルが存在すれば: `{ state: "configured", accounts: [...] }`

`accounts[]` の各要素 (アカウント単位):

| state | 条件 |
|---|---|
| `unavailable` | ファイルはあるが JSON パース失敗 / スキーマ違反 |
| `pending` | ファイルは妥当だが five_hour も seven_day も null |
| `ok` | 少なくとも片方の窓に値がある |

`ok` / `pending` には `ageSeconds` と `stale` (`ageSeconds > 300`) と `label` が付く。`unavailable` には `label` と `reason` (`malformed` or `read_error`) と `message` が付く。

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
- 私が複数の Claude アカウントを使っているか (CLAUDE_CONFIG_DIR や別ディレクトリの存在で判別)
  → 該当する場合は claude-status/<label>.json でアカウントごと書き出す

## 実装後の検証

1. ファイルがスキーマ通りに書かれているか確認:
   - 単一: cat ~/.config/zenterm/claude-status.json
   - 複数: ls ~/.config/zenterm/claude-status/ && cat ~/.config/zenterm/claude-status/*.json
2. (Gateway の AUTH_TOKEN を私が渡せるなら) curl で /api/claude/limits を叩いて
   state が "configured"、accounts[] に期待アカウントが入っていることを確認
3. ZenTerm Web/Mobile UI で更新ボタンを押して反映を確認

## ロールバック

問題があればバックアップから settings.json を復元し、追加スクリプトを削除すれば
クリーンに戻ります。
````

---

## 手動セットアップ (Claude Code に任せたくない場合)

> 以下は推奨経路ではなく、自分で試行錯誤したい人向けの参考情報です。**自己責任** で。

### A. statusline をまだ何も使っていない場合 (単一アカウント)

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

### B. 複数の Claude アカウントを使っている場合 (CLAUDE_CONFIG_DIR で切り替え)

各アカウントの `settings.json` から呼ばれた statusline が **アカウントごとに別ファイル** に書き出すよう、`CLAUDE_CONFIG_DIR` をキーにして書き出し先を分けます。下のブロックを1回だけ貼って `~/.config/zenterm/statusline-multi.sh` を設置:

```bash
mkdir -p ~/.config/zenterm && cat > ~/.config/zenterm/statusline-multi.sh <<'ZENTERM_MULTI_EOF' && chmod +x ~/.config/zenterm/statusline-multi.sh
#!/usr/bin/env bash
set -u
INPUT="$(cat)"

OUT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zenterm/claude-status"
mkdir -p "$OUT_DIR"

# Pick a stable label per Claude config dir.
# Override with $ZENTERM_CLAUDE_LABEL if you want a friendlier name.
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
LABEL="${ZENTERM_CLAUDE_LABEL:-$(basename "$CONFIG_DIR" | sed 's/^\.//')}"
OUT_FILE="$OUT_DIR/${LABEL}.json"
TMP_FILE="$(mktemp "$OUT_DIR/${LABEL}.XXXXXX.json")"

NOW="$(date +%s)"

printf '%s' "$INPUT" | jq --arg label "$LABEL" --argjson now "$NOW" '{
  schema_version: 1,
  captured_at: $now,
  label: $label,
  five_hour: (.rate_limits.five_hour // null
    | if . == null then null
      else { used_percentage: .used_percentage, resets_at: .resets_at } end),
  seven_day: (.rate_limits.seven_day // null
    | if . == null then null
      else { used_percentage: .used_percentage, resets_at: .resets_at } end)
}' > "$TMP_FILE" 2>/dev/null && mv -f "$TMP_FILE" "$OUT_FILE" || rm -f "$TMP_FILE"

exit 0
ZENTERM_MULTI_EOF
```

設定方法 2 通り (使い分け / 併用 OK):
- 各アカウントの `~/.claude/settings.json` 系で `statusLine.command` を `~/.config/zenterm/statusline-multi.sh` に向ける
- `ZENTERM_CLAUDE_LABEL=main ~/.config/zenterm/statusline-multi.sh` のように環境変数で表示名を上書きできる

label が同じだと別アカウントでも上書き合戦になります。`CLAUDE_CONFIG_DIR` 別に必ずユニークになるようにしてください。

### C. 既に statusline を使っている場合 (wrapper パターン)

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
# 単一アカウント
cat ~/.config/zenterm/claude-status.json

# 複数アカウント
ls ~/.config/zenterm/claude-status/
cat ~/.config/zenterm/claude-status/*.json
```

期待する例:

```json
{
  "schema_version": 1,
  "captured_at": 1714377600,
  "label": "main",
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
