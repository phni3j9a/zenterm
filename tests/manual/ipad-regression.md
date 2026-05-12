# iPad リグレッション確認 (Phase 5b Task D14)

## 目的

PC Web 版を iPad で開いた場合に、既存の `/embed/terminal` (モバイル WebView) が無変更で動作することを確認する。
あくまで「壊れていないこと」の確認のみ。iPad 専用 UI 最適化は v2 へ。

## 環境

- iPad (iOS 17+) Safari
- ZenTerm モバイルアプリ (TestFlight ビルドまたは Xcode dev build)

## 手順

### モバイル WebView の独立性

1. iPad で `/embed/terminal?sessionId=<id>` を Safari で開く (モバイルアプリの WebView 内 URL)
2. xterm 表示
3. Phase 5 で web build artifact (`/web/*`) を更新した後も `/embed/*` が無変更であることを diff で確認
4. ZenTerm モバイルアプリを起動 → サーバ追加 → セッション作成 → ターミナル接続
5. PC Web build 更新前後でモバイルアプリの挙動が変わらないこと

### PC Web を iPad で

1. Safari で `/web/sessions` を開く
2. ログイン (4 桁 token)
3. Sidebar 表示確認
4. Sessions 一覧確認
5. セッション選択 → xterm 表示
6. `echo hello` で出力
7. Sidebar resizer のタッチドラッグ (touchAction: 'none' 効くか)
8. Layout 切替 (タッチで grid-2x2)
9. Sidebar 折りたたみ (タッチで toggle)
10. Settings タブ → Theme 切替

### 既存 endpoint 干渉

- [ ] `/api/sessions` が PC Web からも `/embed/terminal` からも同じレスポンスを返す
- [ ] `/ws/terminal/<sessionId>` が PC Web からも モバイルアプリからも接続可能
- [ ] Gateway log に `assets/web/*` と `/embed/*` の path 区別が明示される

## チェック項目

| 項目 | 期待 | 実測 |
|---|---|---|
| `/embed/terminal` の HTML が PC Web build 後も無変更 | diff なし | |
| モバイルアプリのセッション一覧 | 既存通り表示 | |
| モバイルアプリでターミナル接続・入力 | 動作 | |
| PC Web を iPad Safari で開いたとき | Sidebar + xterm 表示 | |
| PC Web で 1 セッションを開いている状態でモバイルアプリ起動 | 衝突なし | |
| Sidebar resizer のタッチドラッグ | width 変更 (touchAction: 'none' 効果) | |
| ソフトキーボード表示時の layout shift | 妥当 (input にフォーカスが当たる時のみ) | |

## Fail 時の対応

- 致命的 (モバイルアプリが起動できない / セッション接続できない) → 即修正、Phase 5b ブロッカー
- iPad Safari で UI が崩れる → v2 へ送る (本 Task は壊れていないことのみ確認)

## v2 候補へ送る項目

- iPad 専用レイアウト最適化 (Sidebar 強制 collapse、layout 1pane 固定 等)
- iPad のソフトキーボード対応 (フォーカス時のスクロール調整)
- iPad の orientation 切替時の refit

## 記録

実施日: ____  
実施者: ____  
iPad モデル: ____  
iOS: ____  
PASS: __/7  
備考: ____
