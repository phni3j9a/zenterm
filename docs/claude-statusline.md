# Claude Code レート制限を ZenTerm に表示する (experimental)

> **これは experimental 機能です。**
> Claude Code は rate_limits 情報を statusline JSON 経由でしか公式に出していません。
> ZenTerm は `~/.claude/` を一切編集しない方針で運用しているため、連携の設置は **ユーザー自身の責任** で行います。
> 公式 API が出るまでの暫定的な仕組みであることをご理解の上ご利用ください。

**仕様の裏取り用リンク:**
- ZenTerm リポジトリ: https://github.com/phni3j9a/zenterm
- Gateway 読み込みロジック (zod スキーマ / stale 判定 / legacy + per-account 合流): [`server/packages/gateway/src/services/claudeStatus.ts`](https://github.com/phni3j9a/zenterm/blob/main/server/packages/gateway/src/services/claudeStatus.ts)
- API レスポンス型 (discriminated union): [`server/packages/shared/src/index.ts`](https://github.com/phni3j9a/zenterm/blob/main/server/packages/shared/src/index.ts)

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

## ZenTerm 関連リソース (仕様の裏取り用)

困ったら直接コードを読んでください。Gateway 側の実装は public です。

- リポジトリ: https://github.com/phni3j9a/zenterm
- 詳しいセットアップ docs: https://github.com/phni3j9a/zenterm/blob/main/docs/claude-statusline.md
- Gateway の読み込みロジック: server/packages/gateway/src/services/claudeStatus.ts
  (zod スキーマ・stale 判定・legacy + per-account の合流ルール)
- Gateway のルート: server/packages/gateway/src/routes/claude.ts
- 共有型 (UI レスポンスの discriminated union): server/packages/shared/src/index.ts

## 全体の仕組み

[Claude Code]
  └─ statusLine 起動時に rate_limits 等を含む JSON を stdin で statusLine.command に流す
       └─ ZenTerm 連携処理が JSON を抜き出して書き出し
            └─ ~/.config/zenterm/claude-status.json (単一アカウント)
               または ~/.config/zenterm/claude-status/<label>.json (複数アカウント)
                 └─ ZenTerm Gateway (port 18765) が GET /api/claude/limits 受信時に
                    on-demand で読み、zod 検証 + stale 計算 + discriminated union で返す
                      └─ ZenTerm の Web/Mobile UI がバーで表示

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

スキーマ固有の決め事 (Gateway の zod が厳しめなので注意):

- `resets_at` は **必ず Unix epoch sec の整数**。statusLine の入力が ISO8601 文字列で
  来る実装もあり得るが、その場合は epoch sec に変換して書き出す。
  Python 例: `int(datetime.fromisoformat(s.replace('Z','+00:00')).timestamp())`
  jq 例:    `(.resets_at | if type == "string" then (try fromdateiso8601 catch null) else . end)`
  (jq の `fromdateiso8601` は `...Z` 形式のみ。`+09:00` 等のオフセット付きは
   そのままだとパース失敗するため、Python 等で前処理してから渡すのが安全)
- `used_percentage` は 0〜100 の数値。
- 各窓 (`five_hour` / `seven_day`) は `{used_percentage, resets_at}` が **両方揃ったときだけ**
  値を入れる。片方だけ欠損 (例: `used_percentage` はあるが `resets_at` が無い) なら
  その窓全体を null にすること。両フィールド required を Gateway は期待する。
- `label` は UI 表示用 (任意文字列、最大 64 文字)。**ファイル名 stem とは別物**。
  ファイル名側はパストラバーサル防止のため、`[A-Za-z0-9_-]` 以外を `_` に置換し、
  両端の `._-` を strip する。

複数アカウント運用 (重要):

- Claude のアカウントが複数 (例: 通常 ~/.claude/ と CLAUDE_CONFIG_DIR=~/.claude-sub) の場合、
  それぞれの statusline 連携処理は **CLAUDE_CONFIG_DIR ごとに違うファイル** に書き出すこと。
- ラベル決定の推奨方針 (上から順に):
  1. 既存 statusline スクリプトに account_label 相当があれば再利用する
  2. 無ければ `basename($CLAUDE_CONFIG_DIR)` の先頭ドット除去 (`~/.claude-sub` → `claude-sub`)
  3. `CLAUDE_CONFIG_DIR` 未設定 (デフォルト `~/.claude`) は `default` または `main`
- statusLine プロセスは「いま動いているそのアカウント分」しか書けない。両方のファイルを
  最新化するには、両アカウントの Claude Code セッションを実際に動かす必要がある。
  片方だけ動かしている間、もう片方は `stale` (5 分以上前) で表示される。
- **単一 → 複数モードに切り替える際は、過去に書いた `claude-status.json` (legacy) を削除すること**。
  Gateway は legacy と per-account の両方を読むので、放置すると同一アカウントが二重に
  並ぶ可能性がある。

備考:

- five_hour / seven_day は欠落許容: Claude Pro/Max 以外、もしくはセッション内で初回 API
  レスポンスを受け取る前は rate_limits フィールド自体が無い (両方 null で書き出す → pending)
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
6. 既存スクリプト内に挿入する場合、`account_label` などの依存変数が「定義より前」で
   参照されないよう順序に注意する (try/except で握り潰されると静かに動かない)
7. `${XDG_CONFIG_HOME:-~/.config}` を Python で表現する際は、空文字列セット時もフォールバック
   するよう `os.environ.get('XDG_CONFIG_HOME') or os.path.expanduser('~/.config')` を使う
   (`get(key, default)` は空文字列が来ると空文字列を返してしまう)

## 私の現状把握のために見て欲しい

- ~/.claude/settings.json の statusLine 設定
- statusLine.command が指すスクリプトの中身 (自前なら拡張余地、npm パッケージなら wrapper 検討)
- 利用可能なツール (jq / python3 / node)
- 私が複数の Claude アカウントを使っているか (CLAUDE_CONFIG_DIR や別ディレクトリの存在で判別)
  → 該当する場合は claude-status/<label>.json でアカウントごと書き出す

## 実装後の検証

0. **設置直後はファイルが存在しない**。statusLine は描画タイミングで起動するので、
   Claude Code に何か 1 メッセージ送ってから以下を確認すること。
1. ファイルがスキーマ通りに書かれているか確認:
   - 単一: cat ~/.config/zenterm/claude-status.json
   - 複数: ls ~/.config/zenterm/claude-status/ && cat ~/.config/zenterm/claude-status/*.json
2. (Gateway の AUTH_TOKEN を私が渡せるなら) curl で /api/claude/limits を叩いて
   state が "configured"、`accounts[]` に期待アカウントが入っていること、各 account の
   `state` が `ok` (or `pending` if 初回前) になっていることを確認
3. ZenTerm Web/Mobile UI で更新ボタンを押して反映を確認

## ロールバック

問題があればバックアップから settings.json を復元し、追加スクリプトと
~/.config/zenterm/claude-status* を削除すればクリーンに戻ります。
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

printf '%s' "$INPUT" | jq --argjson now "$NOW" '
  def to_epoch:
    # jq の fromdateiso8601 は Z サフィックス形式のみ受付。
    # 数値 epoch / "...Z" 文字列はそのまま、+HH:MM オフセット等は null に倒す。
    if type == "string" then (try fromdateiso8601 catch null)
    elif type == "number" then .
    else null end;
  def window:
    if . == null then null
    elif (.used_percentage == null or .resets_at == null) then null
    else { used_percentage: .used_percentage, resets_at: (.resets_at | to_epoch) } end;
  {
    schema_version: 1,
    captured_at: $now,
    five_hour: (.rate_limits.five_hour // null | window),
    seven_day: (.rate_limits.seven_day // null | window)
  }
' > "$TMP_FILE" 2>/dev/null && mv -f "$TMP_FILE" "$OUT_FILE" || rm -f "$TMP_FILE"

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

printf '%s' "$INPUT" | jq --arg label "$LABEL" --argjson now "$NOW" '
  def to_epoch:
    # jq の fromdateiso8601 は Z サフィックス形式のみ受付。
    # 数値 epoch / "...Z" 文字列はそのまま、+HH:MM オフセット等は null に倒す。
    if type == "string" then (try fromdateiso8601 catch null)
    elif type == "number" then .
    else null end;
  def window:
    if . == null then null
    elif (.used_percentage == null or .resets_at == null) then null
    else { used_percentage: .used_percentage, resets_at: (.resets_at | to_epoch) } end;
  {
    schema_version: 1,
    captured_at: $now,
    label: $label,
    five_hour: (.rate_limits.five_hour // null | window),
    seven_day: (.rate_limits.seven_day // null | window)
  }
' > "$TMP_FILE" 2>/dev/null && mv -f "$TMP_FILE" "$OUT_FILE" || rm -f "$TMP_FILE"

exit 0
ZENTERM_MULTI_EOF
```

設定方法 2 通り (使い分け / 併用 OK):
- 各アカウントの `~/.claude/settings.json` 系で `statusLine.command` を `~/.config/zenterm/statusline-multi.sh` に向ける
- `ZENTERM_CLAUDE_LABEL=main ~/.config/zenterm/statusline-multi.sh` のように環境変数で表示名を上書きできる

label が同じだと別アカウントでも上書き合戦になります。`CLAUDE_CONFIG_DIR` 別に必ずユニークになるようにしてください。

> **単一 (A) → 複数 (B) に切り替える場合、過去に書いた `~/.config/zenterm/claude-status.json` を削除してください。**
> Gateway は legacy ファイルと per-account ディレクトリの両方を読むため、放置すると同一アカウントが二重に表示される可能性があります。

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
| `unconfigured` のまま | ファイル未生成。statusLine は描画タイミングで起動するので、設置直後はまだファイルが無いのが普通。Claude Code に何か 1 メッセージ送ってから確認 |
| `pending` のまま | Claude Pro/Max でない、または初回 API レスポンス未取得。`claude` で何か質問してみる |
| `unavailable: malformed` | jq 未インストール、`resets_at` が ISO8601 文字列のまま、`used_percentage`/`resets_at` 片方欠損、など。`cat` で中身確認 → スキーマ要件を再確認 |
| `stale` (古いデータ) | Claude Code がアイドル。再度メッセージを送ると captured_at が更新される |
| 同じアカウントが 2 つ並ぶ | 単一 (A) → 複数 (B) に切り替えた後、legacy `~/.config/zenterm/claude-status.json` を消し忘れている。削除すれば直る |

## 仕様メモ

- ZenTerm Gateway は `~/.claude/` を **一切編集しません**。ファイル監視も行いません (ポーリングなし、`GET /api/claude/limits` 呼び出し時に毎回 on-demand 読み込み)
- ファイル書き込みは tmp + rename でアトミック (POSIX `rename(2)` 保証) なので部分書き込みは reader 側に見えません
- `schema_version: 1` を維持。将来不互換変更があれば 2 以降に bump
