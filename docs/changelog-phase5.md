# Phase 5 Changelog (2026-05-12)

## Phase 5a (機能 + UX)

### 新機能
- i18n を 8 言語化 (en/ja + es/fr/de/pt-BR/zh-CN/ko)
- URL 逆同期: focused pane の sessionId/windowIndex が URL に反映 (`/web/sessions/:id/window/:idx`)
- URL fragment による pane 状態圧縮 (`#l=cols-2&p=work.0,dev.1`)
- `/web/files/:path*` deep link
- ログイン redirect 先 preserve (deep link を踏んだまま token 入力可能)

### UX 改善
- Tooltip の `aria-describedby` が既存値を上書きせず space-joined に
- SidebarResizer が aside の left edge を考慮して幅を計算
- 4 ペイン上限到達時に Toast 通知 (Palette 経由等で発火)
- events refetch debounce を実機計測根拠付きで 50ms 維持

## Phase 5b (性能 + 互換性 + リファクタ + テスト)

### 性能
- xterm fit の trailing-edge debounce (50ms window) 導入で resize burst を 200/5s → 30/5s 程度に削減
- 4 ペイン同時 `yes` ストレステスト harness と手動 checklist 整備

### a11y
- axe-core を Playwright e2e に統合し critical/serious 違反 0 件を維持
- NVDA / VoiceOver / TalkBack 手動 checklist

### 互換性
- Chrome/Edge 122+ / Firefox 122+ / Safari 17+ / iPad Safari 17+ の対応マトリクス
- iPad: `/embed/terminal` (mobile WebView) との分離を再確認

### リファクタ
- 4 種類の context menu (Terminal / RowActions / Files / FilesSort) を共通 `ui/ContextMenu` に統一
- Portal / Escape / outside-click / 矢印キーナビ / 画面端 flip / disabled item を一元管理

### テスト
- E2E: 実 pointer drag / 実 DataTransfer drop / 右クリックメニュー / fragment 復元

### docs
- root README に PC Web スクリーンショット 5 枚埋め込み
- ブラウザサポート明文化
- changelog-phase5.md (本文)

## v2 候補へ送る項目

- Settings panel sticky / 折りたたみ
- iPad 専用 UI 最適化
- 8 言語の native speaker レビュー (Phase 5 では機械翻訳)
- Service Worker offline 対応
- WebGL renderer
- マルチユーザー共有 URL
