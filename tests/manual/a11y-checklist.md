# 手動 a11y チェックリスト (Phase 5b Task D12)

## 環境

| OS | スクリーンリーダ | ブラウザ |
|---|---|---|
| macOS | VoiceOver (Cmd+F5) | Safari / Chrome |
| Windows | NVDA | Chrome / Firefox |
| Android | TalkBack | Chrome |

## シナリオ (各環境で実施)

### S1: ログイン
- [ ] `/web/login` を開く
- [ ] スクリーンリーダが「ZenTerm sign in」ヘディングを読み上げる
- [ ] Tab で Token input にフォーカス。「Token, edit text」と読まれる
- [ ] 4 桁を入力。ボタンに移動して「Sign in, button」と読まれる
- [ ] Enter で submit。ログイン後 Sidebar が読まれる

### S2: セッション操作
- [ ] Sidebar の Sessions リストを Tab で巡回。各セッション名が読まれる
- [ ] kebab メニューを Space で開く。menuitem 4 件が矢印キーで巡回可能
- [ ] Delete を選択。Confirm dialog が `role="alertdialog"` で modal として読まれる
- [ ] Escape で dialog 閉じる

### S3: ターミナル
- [ ] セッションを選択。ターミナル領域が `<main>` 内に表示される
- [ ] スクリーンリーダはターミナル領域 (xterm canvas) を「unable to read」または「terminal」と認識 (OK)
- [ ] Ctrl+Shift+C で copy。Toast「Copied」が `role="status"` で読まれる

### S4: ファイル
- [ ] Sidebar の Files タブに切替
- [ ] Breadcrumbs が `<nav aria-label="breadcrumb">` で読まれる
- [ ] ファイル選択時、preview pane の見出しが読まれる

### S5: 設定
- [ ] Settings タブに切替
- [ ] Theme/Language/Font size が group として読まれる
- [ ] Toggle ボタンが `aria-pressed` 状態で読まれる

### S6: コマンドパレット
- [ ] Ctrl+K で開く。`role="dialog"` + `aria-label="Command palette"` で modal 認識
- [ ] 矢印キーで候補巡回。Enter で実行
- [ ] Escape で閉じる

### S7: マルチペイン
- [ ] Layout を grid-2x2 に。各 pane が個別の region として読まれる
- [ ] Ctrl+[ / Ctrl+] で pane 切替。focus 移動が伝わる

### S8: SidebarResizer
- [ ] Sidebar resize handle (`role="separator"`) に Tab フォーカス
- [ ] 矢印キー左右で 16px ずつ変化。aria-valuenow が更新される旨を確認

### S9: tooltip
- [ ] Header の各 icon button にホバー (Tab フォーカス) → 500ms 後に tooltip
- [ ] aria-describedby で読まれる

### S10: 4 ペイン上限到達
- [ ] grid-2x2 状態で「New pane」を呼ぶ (Palette 経由)
- [ ] Toast 「Maximum pane count reached」が `role="status"` で読まれる

## 判定

- 全シナリオで「読み上げが意図通り」「キーボードのみで操作可能」「focus loss 無し」の場合 PASS
- 1 件でも focus trap が壊れる / 読み上げが破綻する場合は該当箇所を修正してから再テスト

## 記録

実施日時: ____
実施者: ____
環境: ____
結果: PASS / FAIL
備考:
