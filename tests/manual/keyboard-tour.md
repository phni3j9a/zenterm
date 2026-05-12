# Phase 6 キーボードツアー手動チェックリスト

## 目的

PC Web 版の全主要画面で Tab / Shift+Tab / 矢印 / Enter / Esc が期待どおり動き、focus ring が常に視認できることを確認する。WCAG 2.1 AA の操作性要件 (2.1.1 Keyboard / 2.4.7 Focus Visible) のチェック。

## 環境

- Chromium 122+ / Firefox 122+ / Safari 17+
- OS: macOS / Linux (Mac mini Ubuntu 24.04)
- `prefers-reduced-motion: no-preference` で実施

## チェックリスト

### Login
- [ ] ページ読込時、自動的に OTP[0] にフォーカスが入る
- [ ] 数字入力で OTP[0] → [1] → [2] → [3] に自動移動
- [ ] Tab で OTP 全部スキップして "Sign in" にフォーカス
- [ ] Backspace で前のマスに戻り、内容クリア
- [ ] Esc は何もしない (or page reset)
- [ ] focus ring が各 OTP マスと Sign in button で 2px 緑色 outline で視認できる

### LeftRail (左 64px 縦タブ)
- [ ] Tab で最初の active タブにフォーカス
- [ ] ArrowDown / ArrowUp で 3 タブを循環
- [ ] Enter / Space で activate
- [ ] Logout ボタンには別途 Tab で到達
- [ ] focus ring 視認 (active タブは緑、focus 時 outline)

### Sessions タブ
- [ ] Tab で SessionRow にフォーカス
- [ ] Enter で開く
- [ ] F2 で inline rename 開始
- [ ] Esc で rename キャンセル
- [ ] kebab ボタン (⋯) は Tab 到達可能、Enter でメニュー展開
- [ ] ArrowUp/Down でメニュー項目移動

### Files タブ
- [ ] Tab で Toolbar IconButton 4 つを順に
- [ ] Breadcrumb 各セグメントへ Tab で到達
- [ ] FilesItem への Tab + Enter で navigate
- [ ] FilesViewerPane エリアへ移動

### Settings タブ
- [ ] Tab で各 Section Card 内の最初の control にフォーカス
- [ ] Theme picker (Light/Dark/System) は ArrowKey で切替
- [ ] Gateway CTAs (Copy URL / Show QR / Re-enter / Sign out) すべて Tab + Enter で動作

### Terminal (pane フォーカス時)
- [ ] Cmd+B でサイドバートグル
- [ ] Cmd+K でコマンドパレット
- [ ] Cmd+N で新規ペイン (4 ペインまで)
- [ ] Cmd+1〜9 でウィンドウジャンプ
- [ ] Esc でパレット閉じる

### Modal / Menu
- [ ] ContextMenu: 右クリックで開く → ArrowKey で移動 → Esc で閉じる
- [ ] ConfirmDialog: Esc でキャンセル、Enter で confirm
- [ ] OnboardingGuide: dismiss ボタンへ Tab 到達

### Onboarding (セッション 0 件時)
- [ ] Stepper 3 ステップ各々にスクリーンリーダ読上げ可能
- [ ] Dismiss ボタンクリックで設定保存 + 非表示

### Focus visible 共通
- [ ] マウスクリックでは outline が出ない (`:focus-visible` の仕様)
- [ ] キーボード Tab でフォーカス取得すると outline が出る
- [ ] Dark / Light 両テーマで outline がコントラスト十分

## NG 例 (見つけたら issue 化)

- focus ring が tabular border に隠れて見えない
- IME 入力中に focus がリセットされる
- modal を閉じた後、トリガ要素にフォーカスが戻らない
- Esc が複数 layer を同時に閉じる
