# palmsh Rebuild Handoff

## Goal

既存 `ccmobile` は参考資産として扱い、新しく 2 プロジェクトで作り直す。

- `palmsh-mobile`: Expo / React Native アプリ
- `palmsh-gateway`: Raspberry Pi 上で動く terminal gateway

目的は、iPhone から SSH で Raspberry Pi に入り、Pi 上の Codex だけで開発を進めつつ、最終的に `EAS Build / Submit` を使って iOS / Android に配布できる構成を作ること。

## Fixed Decisions

- iOS / Android 両対応
- `Expo managed` を使う
- 接続先は `LAN / Tailscale`
- 認証は `Bearer token`
- terminal 部分だけ `WebView`
- terminal 描画は当面 `xterm.js`
- 既存 `ccmobile` の UI / API / 構成にはこだわらず、新規設計で進める

## Product Direction

アプリ全体の体験は React Native で作る。terminal 画面だけ WebView を使う。

### RN 側の責務

- 接続先管理
- 認証情報管理
- セッション一覧
- 設定画面
- 接続状態表示
- 特殊キー列
- terminal 画面のシェル

### WebView 側の責務

- `xterm.js` 描画
- WebSocket 接続
- terminal の入出力
- RN との bridge

### Server 側の責務

- Bearer token 認証
- tmux セッション管理
- PTY 制御
- WebSocket terminal 中継
- embed 専用 terminal ページ配信

## Recommended Directory Layout

親ディレクトリ案:

```text
/home/raspi5/projects/palmsh/
  palmsh-mobile/
  palmsh-gateway/
  docs/
```

## Recommended Repo Names

- `palmsh-mobile`
- `palmsh-gateway`

親ディレクトリは `palmsh` を使う。最初からモノレポにはしない。

## Tech Stack

### Mobile

- Expo
- React Native
- expo-router
- react-native-webview
- expo-secure-store
- @tanstack/react-query
- zustand
- zod

### Server

- Node.js 20+
- TypeScript
- Fastify
- ws
- node-pty
- tmux
- pino
- zod

`socket.io` ではなく `ws` を第一候補にする。理由は専用クライアント用としてプロトコルを薄く保ちやすいから。

## High-Level Architecture

```text
React Native app
  ├─ Servers screen
  ├─ Sessions screen
  ├─ Terminal screen
  │    ├─ Native header / status / special keys
  │    └─ WebView
  │         └─ xterm.js terminal client
  └─ Settings screen

Raspberry Pi server
  ├─ REST API
  ├─ WebSocket terminal gateway
  ├─ tmux session manager
  └─ embed terminal page
```

## Initial Screen Plan

1. `Servers`
接続先 URL と token を追加・編集・削除する。

2. `Sessions`
tmux セッション一覧、作成、削除、リネームを行う。

3. `Terminal`
terminal 表示は WebView、ヘッダ・接続状態・特殊キーは RN 側に置く。

4. `Settings`
テーマ、フォントサイズ、再接続設定などを持つ。

## Initial Server API Plan

### REST

- `POST /api/auth/verify`
- `GET /api/sessions`
- `POST /api/sessions`
- `PATCH /api/sessions/:sessionId`
- `DELETE /api/sessions/:sessionId`
- `GET /embed/terminal`

### WebSocket

- `GET /ws/terminal?sessionId=...`

### WebSocket messages

client -> server

- `input`
- `resize`
- `signal`
- `paste`

server -> client

- `output`
- `exit`
- `sessionInfo`
- `error`

## Security Requirements

- Bearer token を必須にする
- REST と WebSocket の両方で認証する
- token は mobile 側で `expo-secure-store` に保存する
- サーバーは LAN / Tailscale 前提
- ストア公開を見据えて `HTTPS / Tailscale` を前提に設計する

## Non-Goals For V1

- terminal の完全ネイティブ実装
- 公開インターネット前提の multi-user SaaS 化
- OAuth / SSO
- 複雑なロール管理

## Key Risks

1. WebView 上での IME 入力
2. iOS のソフトウェアキーボードとフォーカス制御
3. 長時間接続時の安定性
4. 画面回転時の terminal resize
5. バックグラウンド復帰時の再接続

## Milestones

### M1

`palmsh-gateway` 単体で tmux セッション管理と terminal 表示が動く。

### M2

`palmsh-mobile` で接続先登録とセッション一覧が動く。

### M3

mobile アプリ内で terminal 入出力が成立する。

### M4

実機で日常使用できる品質に到達する。

### M5

EAS Build / Submit で TestFlight / Play Internal Testing まで行く。

## First Sprint Scope

最初のスプリントはここまでで切る。

- `palmsh-gateway` 初期化
- Bearer token 認証
- tmux セッション API
- WebSocket terminal gateway
- embed terminal page の最小実装
- `palmsh-mobile` 初期化
- 接続先登録画面
- セッション一覧画面
- Terminal 画面の最小 WebView
- `Esc`, `Tab`, `Ctrl+C` の特殊キー送信

## Acceptance Criteria For First Sprint

- mobile から server に token 付き接続確認ができる
- セッション一覧の取得と新規作成ができる
- Terminal 画面で 1 セッションに接続できる
- コマンド入力結果が表示される
- 特殊キー 3 種が動く
- WebView 再読込後も再接続できる

## Suggested Bootstrap Commands

親ディレクトリ作成:

```bash
mkdir -p /home/raspi5/projects/palmsh
cd /home/raspi5/projects/palmsh
```

server:

```bash
mkdir palmsh-gateway
cd palmsh-gateway
git init
npm init -y
```

mobile:

```bash
cd /home/raspi5/projects/palmsh
npx create-expo-app@latest palmsh-mobile
cd palmsh-mobile
git init
```

## Notes For The Next Codex Session

- 既存 `ccmobile` との互換性は最優先ではない
- まずは新規設計を優先する
- terminal UX の難所は WebView / IME / フォーカス
- UI は Expo / RN で作り、WebView に周辺 UI を持たせない
- サーバーは「埋め込み terminal エンジン」に徹する
