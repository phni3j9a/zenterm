# EAS Build セットアップガイド

## 前提条件
- Apple Developer Program ($99/年) 加入済み
- Node.js 18+ インストール済み
- Expo アカウント作成済み

## 初期セットアップ

### 1. EAS CLI インストール
```bash
npm install -g eas-cli
```

### 2. Expo にログイン
```bash
eas login
```

### 3. プロジェクト初期化
```bash
cd packages/mobile
eas init
```
`app.json` の `extra.eas.projectId` が自動設定される

### 4. プレビュービルド（AdHoc 配信）
```bash
eas build --platform ios --profile preview
```
初回はプロビジョニングプロファイルが自動作成される
ビルド完了後、QRコードで iPhone にインストール

### 5. プロダクションビルド（App Store 配信）
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

## eas.json の submit セクション
`eas.json` の `submit.production.ios` にある以下のプレースホルダを実際の値に置換:
- `PLACEHOLDER_APPLE_ID`: Apple ID メールアドレス
- `PLACEHOLDER_ASC_APP_ID`: App Store Connect の App ID
- `PLACEHOLDER_APPLE_TEAM_ID`: Apple Developer Team ID

## トラブルシューティング

### monorepo でのビルドエラー
ルートの `package-lock.json` が存在することを確認。
```bash
ls ~/projects/palmsh/package-lock.json
```

### shared パッケージの型解決エラー
`@palmsh/shared` が workspaces で正しくリンクされているか確認。
```bash
npm ls @palmsh/shared
```
