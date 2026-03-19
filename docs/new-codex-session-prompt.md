# Prompt For New Codex Session

新規プロジェクトを以下の前提で開始してください。

## Goal

`ccmobile` をそのまま移植するのではなく、モバイルアプリ中心の新規システムとして再設計します。

- `palmsh-mobile`: Expo / React Native アプリ
- `palmsh-gateway`: Raspberry Pi 上で動く terminal gateway

## Fixed Decisions

- iOS / Android 両対応
- Expo managed
- LAN / Tailscale 接続
- Bearer token 認証
- terminal 部分だけ WebView
- terminal 描画は xterm.js
- 既存 `ccmobile` 互換は最優先ではない

## What To Do First

1. `/home/raspi5/projects/palmsh` を使う
2. その配下の `palmsh-mobile` と `palmsh-gateway` を対象に進める
3. `palmsh-gateway` は TypeScript + Fastify + ws + node-pty + tmux で初期化する
4. `palmsh-mobile` は Expo + expo-router + react-native-webview で初期化する
5. 実装前にディレクトリ構成とタスク分解を短く提示する
6. その後、最小接続経路の実装に入る

## Architecture Direction

### Mobile responsibilities

- 接続先管理
- token 保存
- セッション一覧
- 設定
- 接続状態表示
- 特殊キー列
- Terminal WebView コンテナ

### Server responsibilities

- Bearer token 認証
- tmux セッション管理
- PTY 制御
- WebSocket terminal 中継
- embed terminal page 配信

### Web terminal responsibilities

- xterm.js 描画
- WS 接続
- terminal 入出力
- RN bridge

## Constraints

- 既存 `ccmobile` のコードは参考程度でよい
- まずは最小で成立する構成を作る
- サーバーと mobile の責務は明確に分ける
- terminal 以外の UI は WebView に寄せない
- 変更は小さく積み上げ、各段階で動作確認する

## First Sprint Target

- server の Bearer token 認証
- sessions API
- terminal WebSocket
- embed terminal page
- mobile の接続先登録画面
- session list 画面
- terminal WebView 最小実装
- `Esc`, `Tab`, `Ctrl+C` の送信

## Handoff Document

詳細は以下を参照してください。

`/home/raspi5/projects/palmsh/docs/mobile-rebuild-handoff.md`
