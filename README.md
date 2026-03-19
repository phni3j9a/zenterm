# palmsh

iPhone → Raspberry Pi ターミナル接続システム（モノレポ）

## パッケージ構成

| パッケージ | 概要 |
|-----------|------|
| `packages/gateway` | Fastify + WebSocket + node-pty ターミナルゲートウェイ（RasPi 上で稼働） |
| `packages/mobile` | Expo / React Native モバイルクライアント |
| `packages/shared` | 共通型定義（TmuxSession, WebSocket メッセージ型） |

## セットアップ

```bash
npm install          # 全パッケージの依存を一括インストール
```

## 開発

```bash
# Gateway（RasPi 上で実行）
npm run dev:gateway

# Mobile（Expo dev server）
npm run dev:mobile
```

## ドキュメント

- `docs/` — ハンドオフ資料
- `SESSION-NOTES.md` — 開発セッションメモ
