# ブラウザ互換マトリクス (Phase 5b Task D13)

## サポート対象

| ブラウザ | 最低バージョン | テスト方法 |
|---|---|---|
| Chrome / Edge | 122 | Playwright `--project=chromium` |
| Firefox | 122 | Playwright `--project=firefox` |
| Safari (macOS) | 17 | 手動 |
| iPad Safari | 17 | 手動 |

## 自動テスト (Playwright)

```bash
cd /home/server/projects/zenterm/server
npx playwright test --project=chromium
npx playwright test --project=firefox
```

期待: 全 spec PASS。

## 手動チェック項目 (各環境共通)

### 起動・認証
- [ ] `/web/login` 表示
- [ ] 4 桁 token で sign in 成功
- [ ] Reload してもログイン状態が persist
- [ ] Logout で `/web/login` に戻る

### ターミナル
- [ ] `/web/sessions` で セッション一覧表示
- [ ] セッション選択で xterm 表示
- [ ] `echo hello` で出力
- [ ] Ctrl+C / Ctrl+D が動作
- [ ] スクロールバック 5000 行制限
- [ ] フォントズーム (Ctrl+= / Ctrl+- / Ctrl+0)
- [ ] 検索 (Ctrl+F)

### マルチペイン
- [ ] Layout 切替 (single → cols-2 → cols-3 → grid-2x2 → main-side-2)
- [ ] Ctrl+[ / Ctrl+] で pane 切替
- [ ] splitter ドラッグで比率変更
- [ ] reload で layout + panes 復元

### URL deep link
- [ ] `/web/sessions/<id>` 直アクセス → 該当 session 開く
- [ ] `/web/sessions/<id>/window/<idx>` 直アクセス → window 切替
- [ ] `/web/files/home/<path>` 直アクセス → そのパス表示
- [ ] URL hash `#l=cols-2&p=...` で pane state 復元

### Sidebar
- [ ] Tab 切替 (Sessions / Files / Settings)
- [ ] Sidebar 折りたたみ (Ctrl+B)
- [ ] Sidebar 幅変更 (drag / 矢印キー) と persist

### Files
- [ ] ディレクトリ閲覧
- [ ] ファイル preview (text / markdown / image)
- [ ] アップロード / ダウンロード
- [ ] 新規ファイル / フォルダ作成
- [ ] rename / delete
- [ ] copy / cut / paste

### Settings
- [ ] Theme 切替 (light / dark / system)
- [ ] Language 切替 (8 言語)
- [ ] Font size 変更
- [ ] auto-copy on select トグル
- [ ] Gateway QR 表示
- [ ] Logout

### 右クリックメニュー
- [ ] Terminal: Copy / Paste / Clear / Search / Reconnect / New pane
- [ ] Sidebar Session: rename / delete / Open in pane N
- [ ] Files: rename / copy / cut / delete / details

### D&D
- [ ] Terminal 領域にファイルをドロップ → cwd にアップロード
- [ ] 進捗バナー表示
- [ ] 完了 toast 表示

### Command Palette
- [ ] Ctrl+K で開く
- [ ] コマンド検索 (fuzzy match)
- [ ] セッション名検索
- [ ] Enter で実行
- [ ] Escape で閉じる

## ブラウザ別注意点

### Safari (macOS 17+)
- [ ] `<dialog>` 動作 (Safari 15.4+ ネイティブ対応、polyfill 不要)
- [ ] WebSocket 切断時の reconnect 動作
- [ ] Cmd+K / Cmd+B など Cmd modifier (Mac は `isMac()` true なので Meta)
- [ ] `prefers-color-scheme` 切替

### Firefox 122+
- [ ] スクロールバー表示 (Firefox 独自スタイル)
- [ ] Toast の `role="status"` 読み上げ
- [ ] Pointer events (drag / drop)

### iPad Safari 17+
- [ ] `/web/sessions` のタッチ操作 (Sidebar tap, layout 切替)
- [ ] Resizer ドラッグ (touch action)
- [ ] ソフトキーボード表示時の layout shift
- [ ] `/embed/terminal` (モバイル WebView) が無変更で動作することを別途確認 (D14)

## 判定

- 自動: Chromium / Firefox の Playwright 全 spec PASS
- 手動: Safari / iPad Safari で上記項目すべて PASS

## Fail 時の対応

- ブラウザ固有のバグは v2 へ送る (Phase 5b では「壊れていないこと」を確認する以上の修正はしない)
- ただし critical (起動できない / ログインできない / セッション作成できない) は本 Phase で修正

## 記録

| ブラウザ | 実施日 | 実施者 | PASS 項目数 | FAIL 項目 |
|---|---|---|---|---|
| Chrome 132 (Ubuntu) | | | / 全 | |
| Firefox 132 (Ubuntu) | | | / 全 | |
| Safari 18 (macOS) | | | / 全 | |
| iPad Safari 18 | | | / 全 | |
