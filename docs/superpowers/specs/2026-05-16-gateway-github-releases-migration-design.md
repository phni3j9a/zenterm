# zenterm-gateway 配布経路を GitHub Releases へ移行 設計

- 対象: `packages/gateway`, `deploy/`, リリースワークフロー
- 作成日: 2026-05-16
- 関連:
  - 現状の publish 仕組み: `packages/gateway/package.json:6` (`bin`), `packages/gateway/src/cli.ts:1-147`
  - systemd unit テンプレート: `deploy/zenterm-gateway.service`, `packages/gateway/src/setup.ts:1-237` (`buildSystemdUnit()` ほか)
  - 既存インストール導線: `deploy/install.sh`
  - tmux 保護方針: `server/CLAUDE.md` の "tmux セッションと CGroup" セクション

## 1. 動機

`zenterm-gateway` は現在 npm registry に publish され、ユーザーは `npx zenterm-gateway@latest setup` で systemd / launchd に登録するモデルになっている。自分の Mac mini 本番も同じ経路で稼働している (`~/.config/systemd/user/zenterm-gateway.service` の `ExecStart` が npx 経由)。

この配布形態には以下の問題がある。

1. **過去版を引っ込められない**: npm の unpublish ポリシーは publish 後 72 時間以降は support 経由かつ条件付き。過去 18 versions すべてが事実上永久に流通する。脆弱性が見つかった version を流通から外したいというニーズに応えられない。
2. **アカウント乗っ取りの被害半径が最大**: `zenterm-gateway` は PTY と tmux ソケットを握る = 任意コマンド実行のパッケージ。npm credential が漏れて悪意あるバージョンを publish された場合、`@latest` 自動追従する systemd を持つすべてのインストール先 (=自宅サーバー / Mac mini / Raspberry Pi 級のホスト) が即時に被害を受ける。自分自身が最初の犠牲者になる構造。
3. **`@latest` 自動追従の罠**: npm publish の利便性の中心は `@latest` だが、それは同時に最大の攻撃面でもある。固定 version 運用に切り替えた時点で npm に居続ける積極的理由がほぼ消える。
4. **公開した責任・保守義務感の重荷化**: App Store にアプリ (`zenterm-app`, 別リポジトリ) を出しており、Gateway は実際に少数ユーザーが利用している。配布をやめる選択肢はない一方、npm に居ることで "production-ready" のシグナルが過剰に発信され、心理的負担が増している。

本設計では、新版の配布経路を **GitHub Releases (tarball + install.sh)** に移し、過去版コントロール権を回復しつつ npm credential を廃する。npm registry の既存 version は維持し、移行は段階的に進める。

## 2. 非ゴール

- npm registry の **完全廃止**は行わない。既存 0.6.x utilisateur の systemd が静かに死ぬのを避ける。
- Docker image / SEA single binary への乗り換えは行わない。将来検討。
- App Store のアプリ再申請は行わない (説明文・ヘルプの更新のみ)。
- 過去 18 versions の一括 unpublish は行わない。重大脆弱性版に限り Phase 3 で個別申請。

## 3. ゴール

1. 新 version の主配布経路を GitHub Releases に移す。
2. 移行期間中、既存 npm 経由インストール済みユーザーが何もしなくても稼働を継続できる。
3. 自分の systemd を `@latest` 自動追従から固定 version 参照に切り替え、アカウント乗っ取り時の自己感染を防ぐ。
4. 過去 vulnerable version を必要に応じ npm support に unpublish 申請できる経路を確保する (GitHub Releases 側は asset 削除でいつでも引っ込められる)。

## 4. 全体アーキテクチャ

### 4.1 配布物

GitHub Release asset として次の 4 つを upload する。

| asset | 内容 |
|---|---|
| `zenterm-gateway-${version}.tar.gz` | tarball 本体 (後述) |
| `install.sh` | インストールスクリプト |
| `checksums.txt` | `sha256sum` 出力 |
| attestation (`*.intoto.jsonl`) | `actions/attest-build-provenance` 生成の SLSA provenance |

### 4.2 tarball の中身

```
zenterm-gateway-0.7.0/
├── package.json
├── package-lock.json
├── dist/             # packages/gateway/dist/ を tsc でビルドしたもの
└── public/           # PC Web ビルド (web/) + embedded terminal を含む
```

`node_modules` は **含めない**。ユーザー環境で `npm install --omit=dev` を実行する。これにより:

- `node-pty` の native ビルドはユーザー環境で行われる (現状の `npx zenterm-gateway` と同条件)
- クロスプラット (macOS / Linux × x64 / arm64) を CI で matrix する必要がない
- tarball サイズは現行 npm tarball (16.1 MB unpacked, 推定 ~6 MB gzipped) と同等

### 4.3 インストール先

```
~/.local/share/zenterm-gateway/
├── 0.7.0/
│   ├── dist/
│   ├── public/
│   ├── node_modules/     # install.sh の npm install で生成
│   ├── package.json
│   └── package-lock.json
├── 0.7.1/
│   └── ...
└── current -> 0.7.1      # symlink
```

- **XDG Base Directory** (`$XDG_DATA_HOME` または `~/.local/share`) に従う。
- 複数 version 並存可。
- `current` は symlink で、ExecStart はここを指す。

### 4.4 systemd / launchd の ExecStart

- systemd unit の `ExecStart` を `/usr/bin/node %h/.local/share/zenterm-gateway/current/dist/cli.js` 相当に固定する。
- update: 新 version 展開 → `current` symlink 張替え → `systemctl --user restart zenterm-gateway`。
- rollback: `current` symlink を旧 version に戻して restart。
- 既存 `KillMode=process` (`deploy/zenterm-gateway.service` および `setup.ts:buildSystemdUnit()`) は維持。tmux サーバーは引き続き restart に巻き込まれない。

### 4.5 install.sh エントリーポイント

```bash
# 最新版
curl -fsSL https://github.com/<owner>/zenterm/releases/latest/download/install.sh | bash

# version 固定
curl -fsSL https://github.com/<owner>/zenterm/releases/download/v0.7.0/install.sh | bash -s -- --version v0.7.0
```

`install.sh` の責務 (順序):

1. 環境前提チェック (`node >= 20`, `tmux`, `curl`, `tar`)
2. version 解決 (`--version` 引数または `latest` 経由のリダイレクト)
3. `zenterm-gateway-${version}.tar.gz` + `checksums.txt` をダウンロード
4. SHA256 verify
5. `~/.local/share/zenterm-gateway/${version}/` に展開
6. 該当ディレクトリで `npm install --omit=dev`
7. `~/.config/zenterm/.env` が無ければ対話的に作成 (`cli.ts:106-143` と同等の AUTH_TOKEN 4 桁入力フローを bash で実装し直す。`curl … \| bash` 経由でも stdin が tty に取れるよう `read … < /dev/tty` を使う)
8. systemd / launchd unit を生成 (既存 `setup.ts` のロジックを `current` symlink 参照に修正したものを採用)
9. `current` symlink を新 version に張替え
10. service restart
11. `zenterm-gateway info` 相当の出力 (Tailscale URL / token QR)

### 4.6 CI/Release ワークフロー (`.github/workflows/release.yml`)

trigger: `v*` tag の push。

jobs:

1. checkout
2. `npm ci`
3. `npm run build:web` → `packages/gateway/public/web/` に同梱
4. `npm run build:gateway` → `packages/gateway/dist/`
5. tarball 生成 (`tar czf zenterm-gateway-${version}.tar.gz -C packages/gateway dist public package.json package-lock.json`)
6. `sha256sum *.tar.gz > checksums.txt`
7. `actions/attest-build-provenance@v2` で attestation 生成
8. `gh release create v${version} *.tar.gz install.sh checksums.txt`

ローカル `npm publish` は廃止。リリース操作は **tag push のみ**。

## 5. 移行 Phase

| Phase | 期間目安 | npm 側 | GitHub 側 | 自分の運用 | ユーザー影響 |
|---|---|---|---|---|---|
| 0 | 今日〜 | 0.6.1 で据え置き | まだ無し | systemd `ExecStart` を `npx zenterm-gateway@latest` → `npx zenterm-gateway@0.6.1` に変更 | なし |
| 1 | 〜1 か月 | publish 停止 | v0.7.0 を GitHub Releases として初リリース、install.sh 整備、README 更新 | 自分も GitHub Release 経路に切替 | なし (新規ユーザーが新導線を見るだけ) |
| 2 | 1〜3 か月 | `npm deprecate "zenterm-gateway@<=0.6.1" "Use GitHub Releases: https://github.com/<owner>/zenterm/releases"` | 主経路として運用、ドキュメント整備 | App Store アプリ説明文・README の install 手順を完全切替 | npm `install`/`npx` 実行時に deprecation warning が出る |
| 3 | 6 か月〜 | 重大脆弱性のある古い version を npm support 経由で unpublish 申請 | 必要に応じ古い release asset を整理 | — | 該当 version pin のユーザーは新 version への移行が必要 |

### 5.1 Phase 0 の最小作業

Phase 0 は本日中に着手可能な範囲。具体的には:

- 自分の `~/.config/systemd/user/zenterm-gateway.service` の `ExecStart` を `@latest` から `@0.6.1` (現在公開中の最新) に書き換え、`daemon-reload && restart`。
- これだけで「自分が npm アカウント乗っ取りの最初の犠牲者になる」経路が閉じる。Phase 1 以降の作業に余裕を持って取り組める。

### 5.2 Phase 1 で触るファイル

- 新規: `.github/workflows/release.yml`
- 新規: `deploy/install-from-release.sh` (将来的に `deploy/install.sh` を置き換える候補。Phase 1 中は併存)
- 修正: `packages/gateway/src/setup.ts` — `buildSystemdUnit()` の ExecStart を `current` symlink ベースに変更、`runSetup()` フローに GitHub Release 取得モードを追加
- 修正: `packages/gateway/src/cli.ts` — `setup` サブコマンドのヘルプ更新
- 修正: `README.md` — install 手順を curl ベースに差し替え
- 修正: `server/CLAUDE.md` — "systemd" セクションのアーキ説明を更新

### 5.3 App Store アプリ側との連携

App Store のアプリ (`zenterm-app`, 別リポジトリ) には Gateway セットアップの案内 (Help / README / Setup ガイド) があるはず。Phase 2 のタイミングでアプリ側のドキュメント・ヘルプ画面の文言を curl ベースに更新する。アプリのバイナリ変更は不要 (Gateway の API は変わらない)。

## 6. 既存ユーザーへの後方互換

- **何もしないと**: npm registry の `zenterm-gateway@0.6.1` は維持されるため、`npx zenterm-gateway@0.6.1` をハードコードしている systemd ユーザーはそのまま動き続ける。
- **`@latest` で動いている systemd ユーザー**: Phase 1 では npm に publish しないため、`@latest` は `0.6.1` のままで停滞する。実質「自動更新が止まる」だけで稼働は継続する。Phase 2 で deprecation warning が出るので、その時点で新導線を選んで再インストールしてもらう。
- **重大脆弱性**: Phase 3 で当該 version を npm support に申請。それまでは新規 release を出さずに「GitHub Release を使ってくれ」と告知する。

## 7. リスクと対処

| リスク | 対処 |
|---|---|
| `curl \| bash` 形式への警戒 | install.sh も release asset として版管理し、URL に `v0.7.0/install.sh` のように version を含めて pin 可能にする。README に SHA で verify する手順も併記。 |
| `curl \| bash` 経由で stdin が tty にならず対話プロンプトが死ぬ | bash で `< /dev/tty` を明示し、tty が取れない CI 環境では `AUTH_TOKEN` を環境変数で渡せる非対話モードも提供する。 |
| node-pty ビルド失敗 | 現状の `npm install` と同条件なので新規の問題ではないが、install.sh のエラーメッセージで `python3` / `make` / `gcc` (Linux) や Xcode CLT (macOS) の案内を出す。 |
| `~/.local/share/zenterm-gateway/` の容量肥大 | 当面は手動 `rm -rf`。将来 `zenterm-gateway gc` サブコマンドを検討。 |
| 既存ユーザーの混乱 | README と CHANGELOG に「既存利用者は何もしなくて良い」を明記。Phase 2 の deprecation message に新導線の URL を含める。 |
| GitHub Releases asset の rate limit | 認証なしでも release asset DL に明確な制限はない。配布規模 (推定 < 100/day) では問題にならない。 |
| 移行中に Phase 0 を忘れる | 本ドキュメントの Phase 0 を最初のタスクとして実装 plan の先頭に置く。 |

## 8. テスト方針

- **install.sh のリハーサル**: 既存の `scripts/e2e-docker.sh` と同じ Docker container 内で install.sh を実行し、systemd 風の起動 (service unit を実行) → `/api/health` 到達まで確認するテストを追加。
- **systemd unit 生成**: `setup.ts:buildSystemdUnit()` のユニットテスト (`__tests__/`) を拡張し、新しい `current` symlink ベース ExecStart を検証。
- **手動検証**: Phase 1 リリース前に自分の Mac mini で実機検証 (Phase 0 完了後、別ディレクトリで並走インストール → 動作確認 → 切替)。
- **CI**: `.github/workflows/release.yml` は最初は `workflow_dispatch` でも動かせるようにし、Phase 1 の本番 tag push 前に dry-run で artifact のみ生成して中身を確認する。

## 9. 影響範囲サマリ

- `deploy/install.sh`: そのまま残す (リポジトリクローン経由の開発者向け)。新規に `deploy/install-from-release.sh` を追加。最終的にどちらに収束させるかは Phase 2 で再評価。
- `deploy/zenterm-gateway.service`: ExecStart テンプレートを `current` symlink ベースに更新 (新規導入時のみ。既存 unit は手動更新)。
- `packages/gateway/src/setup.ts`: systemd unit 生成ロジックの修正。
- `packages/gateway/src/cli.ts`: 大きな変更なし (ヘルプ更新程度)。
- `.github/workflows/release.yml`: 新規。
- `README.md`: install セクション全面差し替え。
- `server/CLAUDE.md`: "systemd" 配信アーキテクチャ説明を更新。
- アプリ (`zenterm-app` リポジトリ): Phase 2 でドキュメント更新。コード変更なし。

## 10. オープン論点 (本 spec で結論を持ち越したもの)

- **install.sh が SHA256 だけでなく cosign / attestation 検証も行うか**: `slsa-verifier` を install.sh 内で叩く案もあるが、ユーザー環境への依存が増える。Phase 1 では SHA256 + GitHub TLS のみとし、attestation は release asset として併載するだけにとどめる。
- **GitHub repository は public のままか**: 別リポジトリ `zenterm-app` も絡むため、本 spec の範囲外。現状 public 前提で進める。
- **GC サブコマンド**: 古い version の自動削除は Phase 1 では入れない。後続 issue として記録。
