# PC Web Image Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC Web の `packages/web` で、ターミナルペインへの**ドラッグ&ドロップ**と**`Ctrl/Cmd+Shift+V` クリップボードペースト**を介して、画像/ファイルを `$HOME/uploads/zenterm/` に staging アップロードし、戻ってきた絶対パスをシェル引用付きで stdin に打鍵する。Claude Code 等の TUI に画像を渡せるようにする。

**Architecture:** 入力 (drop / paste) を `useImageDispatch` フックに集約し、既存 API `POST /api/upload` (dest 省略 = staging) を呼んで戻りパスを `XtermView.TerminalActions.write` 経由で pty stdin に流す。サーバー変更ゼロ。ペイン単位で dispatch を持ち、進捗 store はシェル全体で 1 つ (既存 `useUploadProgress`) を排他制御に使う。

**Tech Stack:** TypeScript / React 19 / Vite / xterm.js v6 / zustand / react-i18next / vitest / Playwright (Docker 隔離 e2e)

**Spec:** `docs/superpowers/specs/2026-05-14-web-image-dispatch-design.md`

---

## File Structure

### Create
- `packages/web/src/lib/shellQuote.ts` — POSIX single-quote エスケープ (純粋関数)
- `packages/web/src/lib/__tests__/shellQuote.test.ts`
- `packages/web/src/hooks/useImageDispatch.ts` — 入力 → 順次アップロード → write の集約フック
- `packages/web/src/hooks/__tests__/useImageDispatch.test.tsx`
- `packages/web/src/components/terminal/__tests__/XtermView.paste.test.tsx`
- `tests/e2e/web/image-drop.spec.ts`
- `tests/e2e/web/image-paste.spec.ts`

### Modify
- `packages/web/src/api/client.ts` — `uploadFile(file, destPath?)` の `destPath` を optional 化
- `packages/web/src/api/__tests__/client-files.test.ts` — テスト追加
- `packages/web/src/components/terminal/TerminalDropZone.tsx` — props から `cwd` を削除
- `packages/web/src/components/terminal/__tests__/TerminalDropZone.test.tsx` — 既存テストを cwd 無し版に
- `packages/web/src/components/terminal/XtermView.tsx` — `TerminalActions.write` 追加 / `onPasteImages` prop 追加 / `Ctrl+Shift+V` keydown 書き換え
- `packages/web/src/components/TerminalPane.tsx` — dispatch を hook 経由で組む、cwd 依存を除去
- `packages/web/src/components/layout/MultiPaneArea.tsx` — `onDropFiles` / `uploadProgress` の経由を撤去 (TerminalPane が自前で hook を使うため)
- `packages/web/src/components/AuthenticatedShell.tsx` — `handleTerminalDrop` を撤去、`apiClient` を TerminalPane / MultiPaneArea に props で渡す
- `packages/web/src/i18n/locales/{en,ja,zh-CN,ko,es,de,fr,pt-BR}.json` — `terminal.dropHint` 差し替え + 新規キー 4 つ
- `tests/e2e/web/phase5-coverage.spec.ts` — drop の挙動変更 (cwd upload → staging upload + パス打鍵) に合わせて期待値修正

---

## Task 1: `shellQuote` 純粋関数

POSIX シェルの single-quote エスケープを行うユーティリティを TDD で実装する。

**Files:**
- Create: `packages/web/src/lib/shellQuote.ts`
- Test: `packages/web/src/lib/__tests__/shellQuote.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/lib/__tests__/shellQuote.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shellQuote } from '../shellQuote';

describe('shellQuote', () => {
  it('wraps an empty string in two single quotes', () => {
    expect(shellQuote('')).toBe("''");
  });

  it('wraps a plain alphanumeric string in single quotes', () => {
    expect(shellQuote('foo')).toBe("'foo'");
  });

  it('keeps spaces inside the quotes', () => {
    expect(shellQuote('foo bar')).toBe("'foo bar'");
  });

  it('escapes single quotes by closing+escaping+reopening', () => {
    // foo'bar -> 'foo'\''bar'
    expect(shellQuote("foo'bar")).toBe("'foo'\\''bar'");
  });

  it('handles a string that is only a single quote', () => {
    // ' -> ''\'''
    expect(shellQuote("'")).toBe("''\\'''");
  });

  it('handles consecutive single quotes', () => {
    // '' -> ''\''\'''
    expect(shellQuote("''")).toBe("''\\''\\'''");
  });

  it('passes UTF-8 characters through untouched', () => {
    expect(shellQuote('日本語ファイル.png')).toBe("'日本語ファイル.png'");
  });

  it('does not strip absolute paths', () => {
    expect(shellQuote('/home/user/uploads/zenterm/2026-05-14_120000_abcd.png'))
      .toBe("'/home/user/uploads/zenterm/2026-05-14_120000_abcd.png'");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd packages/web && npx vitest run src/lib/__tests__/shellQuote.test.ts`
Expected: FAIL with `Cannot find module '../shellQuote'` or similar.

- [ ] **Step 3: Implement `shellQuote`**

Create `packages/web/src/lib/shellQuote.ts`:

```ts
/**
 * POSIX shell single-quote escape.
 * 'foo'bar' -> "'foo'\''bar'"
 * Always returns a string wrapped in single quotes (so the empty string becomes "''").
 */
export function shellQuote(input: string): string {
  return `'${input.replace(/'/g, "'\\''")}'`;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd packages/web && npx vitest run src/lib/__tests__/shellQuote.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/shellQuote.ts packages/web/src/lib/__tests__/shellQuote.test.ts
git commit -m "feat(web): add shellQuote POSIX single-quote escape utility"
```

---

## Task 2: i18n キーの追加 / `terminal.dropHint` 差し替え

ヒント文言を staging 用に差し替え、新規キーを 8 言語に追加する。後続タスクで参照する。

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`
- Modify: `packages/web/src/i18n/locales/zh-CN.json`
- Modify: `packages/web/src/i18n/locales/ko.json`
- Modify: `packages/web/src/i18n/locales/es.json`
- Modify: `packages/web/src/i18n/locales/de.json`
- Modify: `packages/web/src/i18n/locales/fr.json`
- Modify: `packages/web/src/i18n/locales/pt-BR.json`

- [ ] **Step 1: 差分一覧を決定**

`terminal` namespace 内で以下のように変更する (各言語):

| キー | 変更種別 | 内容 |
|---|---|---|
| `dropHint` | 差し替え | "Drop files to upload to session cwd" → "Drop files or images to send to Claude/terminal" |
| `clipboardPermission` | **新規** | "Allow clipboard access in your browser" |
| `clipboardUnsupported` | **新規** | "This browser does not support clipboard image reads" |
| `notConnected` | **新規** | "Terminal is not connected; image path was not sent" |
| `uploadSizeExceeded` | **新規** | "File size exceeded the upload limit (10 MB)" |

- [ ] **Step 2: `en.json` を更新**

`packages/web/src/i18n/locales/en.json` の `terminal` セクションで:

```diff
-    "dropHint": "Drop files to upload to session cwd",
+    "dropHint": "Drop files or images to send to Claude/terminal",
     "uploadProgress": "Uploading {{current}} ({{completed}}/{{total}})",
     "uploadDone": "Uploaded {{count}} file(s)",
     "uploadError": "Upload failed: {{message}}",
     "uploadBusy": "Another upload is in progress",
+    "uploadSizeExceeded": "File size exceeded the upload limit (10 MB)",
+    "clipboardPermission": "Allow clipboard access in your browser",
+    "clipboardUnsupported": "This browser does not support clipboard image reads",
+    "notConnected": "Terminal is not connected; image path was not sent",
```

- [ ] **Step 3: `ja.json` を更新**

```diff
-    "dropHint": "ファイルをドロップしてセッション cwd にアップロード",
+    "dropHint": "ファイル/画像をドロップして Claude などに渡す",
     "uploadProgress": "アップロード中 {{current}} ({{completed}}/{{total}})",
     "uploadDone": "{{count}} ファイルをアップロードしました",
     "uploadError": "アップロード失敗: {{message}}",
     "uploadBusy": "別のアップロードが進行中です",
+    "uploadSizeExceeded": "ファイルサイズが上限 (10 MB) を超えました",
+    "clipboardPermission": "ブラウザのクリップボード権限を許可してください",
+    "clipboardUnsupported": "このブラウザはクリップボード画像読み取りに対応していません",
+    "notConnected": "ターミナルが切断中のため画像パスを送信できませんでした",
```

- [ ] **Step 4: 残り 6 言語に同じキーを追加**

各ファイル (`zh-CN.json`, `ko.json`, `es.json`, `de.json`, `fr.json`, `pt-BR.json`) の `terminal` セクションで `dropHint` を以下に差し替えて新規キー 4 つを追記。**翻訳は機械翻訳の妥当な対訳でよい**。

zh-CN.json:
```diff
-    "dropHint": "拖放文件以上传到当前会话目录",
+    "dropHint": "拖放文件或图片以发送给 Claude/终端",
     ...
+    "uploadSizeExceeded": "文件大小超过了上传限制 (10 MB)",
+    "clipboardPermission": "请在浏览器中允许剪贴板访问",
+    "clipboardUnsupported": "此浏览器不支持剪贴板图片读取",
+    "notConnected": "终端未连接，未能发送图片路径",
```

ko.json:
```diff
-    "dropHint": "...",
+    "dropHint": "파일이나 이미지를 드롭하여 Claude/터미널에 보내기",
     ...
+    "uploadSizeExceeded": "파일 크기가 업로드 한도 (10 MB) 를 초과했습니다",
+    "clipboardPermission": "브라우저에서 클립보드 접근을 허용해주세요",
+    "clipboardUnsupported": "이 브라우저는 클립보드 이미지 읽기를 지원하지 않습니다",
+    "notConnected": "터미널이 연결되지 않아 이미지 경로를 전송하지 못했습니다",
```

es.json:
```diff
+    "dropHint": "Suelta archivos o imágenes para enviarlos a Claude/terminal",
+    "uploadSizeExceeded": "El tamaño del archivo superó el límite de carga (10 MB)",
+    "clipboardPermission": "Permite el acceso al portapapeles en tu navegador",
+    "clipboardUnsupported": "Este navegador no admite la lectura de imágenes del portapapeles",
+    "notConnected": "El terminal no está conectado; la ruta de la imagen no se envió",
```

de.json:
```diff
+    "dropHint": "Dateien oder Bilder hier ablegen, um sie an Claude/Terminal zu senden",
+    "uploadSizeExceeded": "Die Dateigröße hat das Upload-Limit (10 MB) überschritten",
+    "clipboardPermission": "Bitte den Zwischenablage-Zugriff im Browser erlauben",
+    "clipboardUnsupported": "Dieser Browser unterstützt das Lesen von Bildern aus der Zwischenablage nicht",
+    "notConnected": "Das Terminal ist nicht verbunden; der Bildpfad wurde nicht gesendet",
```

fr.json:
```diff
+    "dropHint": "Déposez des fichiers ou images pour les envoyer à Claude/terminal",
+    "uploadSizeExceeded": "La taille du fichier dépasse la limite de téléversement (10 Mo)",
+    "clipboardPermission": "Autorisez l'accès au presse-papiers dans votre navigateur",
+    "clipboardUnsupported": "Ce navigateur ne prend pas en charge la lecture d'images du presse-papiers",
+    "notConnected": "Le terminal n'est pas connecté ; le chemin de l'image n'a pas été envoyé",
```

pt-BR.json:
```diff
+    "dropHint": "Solte arquivos ou imagens para enviar ao Claude/terminal",
+    "uploadSizeExceeded": "O tamanho do arquivo excedeu o limite de upload (10 MB)",
+    "clipboardPermission": "Permita o acesso à área de transferência no navegador",
+    "clipboardUnsupported": "Este navegador não suporta leitura de imagens da área de transferência",
+    "notConnected": "O terminal não está conectado; o caminho da imagem não foi enviado",
```

- [ ] **Step 5: JSON が壊れていないか確認**

Run: `cd packages/web && node -e "for (const f of ['en','ja','zh-CN','ko','es','de','fr','pt-BR']) require('./src/i18n/locales/'+f+'.json')"`
Expected: 何も出力されず exit 0 (= JSON が有効)。

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/i18n/locales/
git commit -m "i18n(web): replace dropHint and add clipboard/connect/size keys (8 langs)"
```

---

## Task 3: `ApiClient.uploadFile` の `destPath` を optional 化

`destPath` 未指定なら `?dest=` クエリ無しで POST する。既存呼び出しは互換維持。

**Files:**
- Modify: `packages/web/src/api/client.ts:167-181`
- Modify: `packages/web/src/api/__tests__/client-files.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`packages/web/src/api/__tests__/client-files.test.ts` の末尾 (`uploadFile POST /api/upload?dest=&preserveName=true with FormData` テストの直後) に新規ケースを追加:

```ts
  it('uploadFile POST /api/upload (no query) when destPath is omitted', async () => {
    fetchSpy.mockResolvedValue(makeRes({
      success: true,
      path: '/home/u/uploads/zenterm/2026-05-14_120000_abcd1234.png',
      filename: '2026-05-14_120000_abcd1234.png',
      size: 4,
      mimetype: 'image/png',
    }));
    const c = new ApiClient('http://gw', 'tok');
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const f = new File([blob], 'shot.png', { type: 'image/png' });
    const res = await c.uploadFile(f);
    expect(fetchSpy.mock.calls[0][0]).toBe('http://gw/api/upload');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(res.path).toBe('/home/u/uploads/zenterm/2026-05-14_120000_abcd1234.png');
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/api/__tests__/client-files.test.ts`
Expected: 新規テストが TypeScript エラー (`Expected 2 arguments, but got 1.`) で失敗。

- [ ] **Step 3: 実装を更新**

`packages/web/src/api/client.ts:167-181` を以下に置き換える:

```ts
  async uploadFile(file: File, destPath?: string): Promise<FileUploadResponse> {
    const url = destPath === undefined
      ? `${this.baseUrl}/api/upload`
      : `${this.baseUrl}/api/upload?dest=${encodeURIComponent(destPath)}&preserveName=true`;
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(res.status, text);
    }
    return (await res.json()) as FileUploadResponse;
  }
```

- [ ] **Step 4: テスト全部 pass を確認**

Run: `cd packages/web && npx vitest run src/api/__tests__/client-files.test.ts`
Expected: 全テスト PASS。既存 `uploadFile POST /api/upload?dest=&preserveName=true with FormData` も依然 PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/api/__tests__/client-files.test.ts
git commit -m "feat(web): make ApiClient.uploadFile destPath optional for staging upload"
```

---

## Task 4: `useImageDispatch` フックを TDD で実装

入力 (File[]) → 順次アップロード → シェル引用付きで write を一括処理する hook。

**Files:**
- Create: `packages/web/src/hooks/useImageDispatch.ts`
- Test: `packages/web/src/hooks/__tests__/useImageDispatch.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

Create `packages/web/src/hooks/__tests__/useImageDispatch.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useImageDispatch, type ImageDispatchDeps } from '../useImageDispatch';
import type { ApiClient } from '@/api/client';
import type { UploadProgressApi } from '../useUploadProgress';

function makeProgress(active = false): UploadProgressApi {
  return {
    active,
    total: 0,
    completed: 0,
    currentFile: undefined,
    error: undefined,
    begin: vi.fn(),
    markStart: vi.fn(),
    markDone: vi.fn(),
    fail: vi.fn(),
    finish: vi.fn(),
  };
}

function makeDeps(over: Partial<ImageDispatchDeps> = {}): ImageDispatchDeps {
  const apiClient = { uploadFile: vi.fn() } as unknown as ApiClient;
  return {
    apiClient,
    write: vi.fn().mockReturnValue(true),
    uploadProgress: makeProgress(),
    pushToast: vi.fn(),
    t: ((key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key) as ImageDispatchDeps['t'],
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('useImageDispatch', () => {
  it('does nothing when files array is empty', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useImageDispatch(deps));
    await act(async () => {
      await result.current.dispatch([]);
    });
    expect(deps.uploadProgress.begin).not.toHaveBeenCalled();
    expect(deps.apiClient.uploadFile).not.toHaveBeenCalled();
    expect(deps.write).not.toHaveBeenCalled();
  });

  it('shows uploadBusy toast and early-returns when uploadProgress.active', async () => {
    const deps = makeDeps({ uploadProgress: makeProgress(true) });
    const { result } = renderHook(() => useImageDispatch(deps));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([file]);
    });
    expect(deps.pushToast).toHaveBeenCalledWith({ type: 'error', message: 'terminal.uploadBusy' });
    expect(deps.apiClient.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads a single file and writes the quoted path with trailing space', async () => {
    const deps = makeDeps();
    (deps.apiClient.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      path: '/home/u/uploads/zenterm/2026-05-14_120000_abcd.png',
      filename: '2026-05-14_120000_abcd.png',
      size: 1,
      mimetype: 'image/png',
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([file]);
    });
    expect(deps.uploadProgress.begin).toHaveBeenCalledWith(1);
    expect(deps.uploadProgress.markStart).toHaveBeenCalledWith('a.png');
    expect(deps.uploadProgress.markDone).toHaveBeenCalledTimes(1);
    expect(deps.write).toHaveBeenCalledWith(
      "'/home/u/uploads/zenterm/2026-05-14_120000_abcd.png' ",
    );
    expect(deps.pushToast).toHaveBeenCalledWith({
      type: 'success',
      message: expect.stringContaining('terminal.uploadDone'),
    });
  });

  it('uploads multiple files sequentially in order, writing each path with a space', async () => {
    const deps = makeDeps();
    const calls: string[] = [];
    (deps.apiClient.uploadFile as ReturnType<typeof vi.fn>).mockImplementation(
      async (f: File) => {
        calls.push(`upload:${f.name}`);
        return {
          success: true,
          path: `/staging/${f.name}`,
          filename: f.name,
          size: 1,
          mimetype: 'image/png',
        };
      },
    );
    (deps.write as ReturnType<typeof vi.fn>).mockImplementation((text: string) => {
      calls.push(`write:${text}`);
      return true;
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const f1 = new File(['x'], 'a.png', { type: 'image/png' });
    const f2 = new File(['y'], 'b.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([f1, f2]);
    });
    expect(calls).toEqual([
      'upload:a.png',
      "write:'/staging/a.png' ",
      'upload:b.png',
      "write:'/staging/b.png' ",
    ]);
  });

  it('on upload failure, calls fail+pushToast and aborts remaining files', async () => {
    const deps = makeDeps();
    (deps.apiClient.uploadFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        success: true,
        path: '/staging/ok.png',
        filename: 'ok.png',
        size: 1,
        mimetype: 'image/png',
      })
      .mockRejectedValueOnce(new Error('413 too large'));
    const { result } = renderHook(() => useImageDispatch(deps));
    const f1 = new File(['x'], 'ok.png', { type: 'image/png' });
    const f2 = new File(['y'], 'bad.png', { type: 'image/png' });
    const f3 = new File(['z'], 'never.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([f1, f2, f3]);
    });
    expect(deps.apiClient.uploadFile).toHaveBeenCalledTimes(2); // f3 is not attempted
    expect(deps.write).toHaveBeenCalledTimes(1); // only f1's path
    expect(deps.uploadProgress.fail).toHaveBeenCalledWith('413 too large');
    expect(deps.pushToast).toHaveBeenCalledWith({
      type: 'error',
      message: expect.stringContaining('terminal.uploadError'),
    });
  });

  it('on write returning false (WebSocket closed), shows notConnected toast and aborts remaining files', async () => {
    const deps = makeDeps({ write: vi.fn().mockReturnValue(false) });
    (deps.apiClient.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      path: '/staging/a.png',
      filename: 'a.png',
      size: 1,
      mimetype: 'image/png',
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const f1 = new File(['x'], 'a.png', { type: 'image/png' });
    const f2 = new File(['y'], 'b.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([f1, f2]);
    });
    expect(deps.apiClient.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.pushToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'terminal.notConnected',
    });
  });

  it('calls finish() after success with 1500ms delay', async () => {
    const deps = makeDeps();
    (deps.apiClient.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      path: '/staging/a.png',
      filename: 'a.png',
      size: 1,
      mimetype: 'image/png',
    });
    const { result } = renderHook(() => useImageDispatch(deps));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await act(async () => {
      await result.current.dispatch([file]);
    });
    expect(deps.uploadProgress.finish).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await waitFor(() => expect(deps.uploadProgress.finish).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/hooks/__tests__/useImageDispatch.test.tsx`
Expected: FAIL with `Cannot find module '../useImageDispatch'`.

- [ ] **Step 3: フックを実装**

Create `packages/web/src/hooks/useImageDispatch.ts`:

```ts
import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import type { ApiClient } from '@/api/client';
import { shellQuote } from '@/lib/shellQuote';
import type { UploadProgressApi } from './useUploadProgress';
import type { ToastEntry } from '@/stores/ui';

export interface ImageDispatchDeps {
  apiClient: ApiClient | null;
  /** write returns true if the bytes were handed to the WebSocket, false if WS is closed. */
  write: (text: string) => boolean;
  uploadProgress: UploadProgressApi;
  pushToast: (toast: Omit<ToastEntry, 'id'>) => void;
  t: TFunction;
}

export interface ImageDispatchApi {
  dispatch: (files: File[]) => Promise<void>;
}

export function useImageDispatch(deps: ImageDispatchDeps): ImageDispatchApi {
  const dispatch = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return;
      if (!deps.apiClient) return;
      if (deps.uploadProgress.active) {
        deps.pushToast({ type: 'error', message: deps.t('terminal.uploadBusy') });
        return;
      }
      deps.uploadProgress.begin(files.length);
      for (const file of files) {
        deps.uploadProgress.markStart(file.name);
        let path: string;
        try {
          const res = await deps.apiClient.uploadFile(file);
          path = res.path;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          deps.uploadProgress.fail(msg);
          deps.pushToast({
            type: 'error',
            message: deps.t('terminal.uploadError', { message: msg }),
          });
          setTimeout(() => deps.uploadProgress.finish(), 3000);
          return;
        }
        deps.uploadProgress.markDone();
        const ok = deps.write(`${shellQuote(path)} `);
        if (!ok) {
          deps.uploadProgress.fail(deps.t('terminal.notConnected'));
          deps.pushToast({ type: 'error', message: deps.t('terminal.notConnected') });
          setTimeout(() => deps.uploadProgress.finish(), 3000);
          return;
        }
      }
      deps.pushToast({
        type: 'success',
        message: deps.t('terminal.uploadDone', { count: files.length }),
      });
      setTimeout(() => deps.uploadProgress.finish(), 1500);
    },
    [deps],
  );
  return { dispatch };
}
```

- [ ] **Step 4: テスト全部 pass を確認**

Run: `cd packages/web && npx vitest run src/hooks/__tests__/useImageDispatch.test.tsx`
Expected: 7 テスト PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/hooks/useImageDispatch.ts packages/web/src/hooks/__tests__/useImageDispatch.test.tsx
git commit -m "feat(web): add useImageDispatch hook for staging upload + stdin write"
```

---

## Task 5: `TerminalDropZone` から `cwd` prop を取り除く

ペイン上のドロップは全部 staging 行きなので `cwd` は不要に。表示文言キーは現状 (`terminal.dropHint`) のまま参照、Task 2 で内容が差し替わっているので「ファイル/画像をドロップして Claude などに渡す」が表示される。

**Files:**
- Modify: `packages/web/src/components/terminal/TerminalDropZone.tsx`
- Modify: `packages/web/src/components/terminal/__tests__/TerminalDropZone.test.tsx`

- [ ] **Step 1: テストを新シグネチャに更新**

`packages/web/src/components/terminal/__tests__/TerminalDropZone.test.tsx` の全体を以下に置き換える:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { TerminalDropZone } from '../TerminalDropZone';

function makeDragEvent(types: string[]): Partial<DragEvent> {
  return {
    dataTransfer: { types } as unknown as DataTransfer,
    preventDefault: vi.fn(),
  };
}

describe('TerminalDropZone', () => {
  it('renders nothing when inactive (no drag over window)', () => {
    const { container } = render(<TerminalDropZone onFiles={vi.fn()} />);
    const region = container.querySelector('[role="region"]');
    expect(region).toBeNull();
  });

  it('shows overlay after window dragenter with Files type', () => {
    render(<TerminalDropZone onFiles={vi.fn()} />);
    fireEvent(
      window,
      Object.assign(new Event('dragenter'), makeDragEvent(['Files'])),
    );
    const region = screen.getByRole('region');
    expect(region).toBeTruthy();
  });

  it('calls onFiles(files) when files are dropped on the overlay', () => {
    const onFiles = vi.fn();
    render(<TerminalDropZone onFiles={onFiles} />);
    fireEvent(
      window,
      Object.assign(new Event('dragenter'), makeDragEvent(['Files'])),
    );
    const region = screen.getByRole('region');
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    fireEvent.drop(region, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/components/terminal/__tests__/TerminalDropZone.test.tsx`
Expected: 3 つとも失敗 (TS の型エラー or `cwd` を依然受けるため expectation 不一致)。

- [ ] **Step 3: `TerminalDropZone.tsx` を更新**

`packages/web/src/components/terminal/TerminalDropZone.tsx` を以下に置き換える:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  onFiles: (files: File[]) => void;
}

export function TerminalDropZone({ onFiles }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let counter = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counter++;
      setActive(true);
    };
    const leave = () => {
      counter = Math.max(0, counter - 1);
      if (counter === 0) setActive(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      role="region"
      aria-label={t('terminal.dropHint')}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        setActive(false);
        if (files.length > 0) onFiles(files);
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        color: tokens.colors.textPrimary,
        fontSize: tokens.typography.heading.fontSize,
        pointerEvents: 'auto',
        border: `2px dashed ${tokens.colors.primary}`,
      }}
    >
      {t('terminal.dropHint')}
    </div>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

Run: `cd packages/web && npx vitest run src/components/terminal/__tests__/TerminalDropZone.test.tsx`
Expected: 3 PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/terminal/TerminalDropZone.tsx packages/web/src/components/terminal/__tests__/TerminalDropZone.test.tsx
git commit -m "refactor(web): remove cwd prop from TerminalDropZone (staging unification)"
```

---

## Task 6: `XtermView` に `write` を公開し、`Ctrl+Shift+V` を画像対応に拡張

`TerminalActions` に `write(text): boolean` を追加し、`Ctrl/Cmd+Shift+V` 押下時にクリップボード画像を取得して `onPasteImages` で外に渡す。画像が無ければ従来のテキストペーストにフォールバック。

**Files:**
- Modify: `packages/web/src/components/terminal/XtermView.tsx`
- Create: `packages/web/src/components/terminal/__tests__/XtermView.paste.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

Create `packages/web/src/components/terminal/__tests__/XtermView.paste.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('@xterm/xterm', () => {
  const Terminal = vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    write: vi.fn(),
    options: {},
    onData: () => ({ dispose: vi.fn() }),
    onResize: () => ({ dispose: vi.fn() }),
    onSelectionChange: () => ({ dispose: vi.fn() }),
    onBell: () => ({ dispose: vi.fn() }),
    focus: vi.fn(),
    getSelection: () => '',
    clear: vi.fn(),
    dispose: vi.fn(),
    attachCustomKeyEventHandler: vi.fn(),
    cols: 80,
    rows: 24,
  }));
  return { Terminal };
});
vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })) }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@xterm/addon-search', () => ({
  SearchAddon: vi.fn().mockImplementation(() => ({ findNext: vi.fn(), findPrevious: vi.fn(), clearDecorations: vi.fn() })),
}));

import { Terminal } from '@xterm/xterm';
import { XtermView } from '../XtermView';

function lastHandler() {
  const calls = (Terminal as unknown as ReturnType<typeof vi.fn>).mock.results;
  const inst = calls[calls.length - 1].value;
  return (inst.attachCustomKeyEventHandler as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: KeyboardEvent) => boolean;
}

const baseProps = {
  gatewayUrl: 'http://gw',
  token: 'tok',
  sessionId: 'sess',
  windowIndex: 0,
  isFocused: true,
  isVisible: true,
  reconnectNonce: 0,
  onStatusChange: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('XtermView paste extension', () => {
  it('calls onPasteImages when clipboard has an image item', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' });
    const item = {
      types: ['image/png'],
      getType: vi.fn(async (t: string) => (t === 'image/png' ? blob : new Blob())),
    } as unknown as ClipboardItem;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockResolvedValue([item]), readText: vi.fn().mockResolvedValue('') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true });
    const result = lastHandler()(ev);
    expect(result).toBe(false);
    await waitFor(() => expect(onPasteImages).toHaveBeenCalled());
    const files: File[] = onPasteImages.mock.calls[0][0];
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe('image/png');
    expect(files[0].name).toMatch(/^image_\d+_0\.png$/);
  });

  it('falls back to text paste when clipboard has no image', async () => {
    const item = {
      types: ['text/plain'],
      getType: vi.fn(async () => new Blob(['hi'], { type: 'text/plain' })),
    } as unknown as ClipboardItem;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockResolvedValue([item]), readText: vi.fn().mockResolvedValue('hello') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true });
    lastHandler()(ev);
    await waitFor(() => expect(navigator.clipboard.readText).toHaveBeenCalled());
    expect(onPasteImages).not.toHaveBeenCalled();
  });

  it('falls back to text paste when clipboard.read rejects with NotAllowedError', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockRejectedValue(err), readText: vi.fn().mockResolvedValue('text-fallback') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true });
    lastHandler()(ev);
    await waitFor(() => expect(navigator.clipboard.readText).toHaveBeenCalled());
  });

  it('also handles Cmd+Shift+V on macOS', async () => {
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    const item = {
      types: ['image/jpeg'],
      getType: vi.fn(async () => blob),
    } as unknown as ClipboardItem;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockResolvedValue([item]), readText: vi.fn().mockResolvedValue('') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', metaKey: true, shiftKey: true });
    const result = lastHandler()(ev);
    expect(result).toBe(false);
    await waitFor(() => expect(onPasteImages).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/components/terminal/__tests__/XtermView.paste.test.tsx`
Expected: FAIL (`onPasteImages` prop が型に無い、画像経路が未実装、等)。

- [ ] **Step 3: `XtermView.tsx` の `TerminalActions` と props を拡張**

`packages/web/src/components/terminal/XtermView.tsx:57-76` (`TerminalActions` と `XtermViewProps`) を:

```ts
export interface TerminalActions {
  copy: () => void;
  paste: () => void;
  clear: () => void;
  /** Send text bytes to the pty stdin. Returns true if sent, false if WS is not OPEN. */
  write: (text: string) => boolean;
}

export interface XtermViewProps {
  gatewayUrl: string;
  token: string;
  sessionId: string;
  windowIndex: number;
  isFocused: boolean;
  isVisible: boolean;
  reconnectNonce: number;
  onStatusChange: (status: TerminalStatus) => void;
  onReconnectInfo?: (info: ReconnectInfo | null) => void;
  onContextMenu?: (info: { x: number; y: number; hasSelection: boolean }) => void;
  onActionsReady?: (actions: TerminalActions) => void;
  onSearchReady?: (api: TerminalSearchApi) => void;
  /** Called when clipboard image(s) are pasted (Ctrl/Cmd+Shift+V). */
  onPasteImages?: (files: File[]) => void;
}
```

- [ ] **Step 4: `XtermView` 関数引数に `onPasteImages` を追加**

`packages/web/src/components/terminal/XtermView.tsx:78-91` の関数本体引数に `onPasteImages` を追加し、その下のリフ宣言群に `onPasteImagesRef` を追加:

```ts
export function XtermView({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isFocused,
  isVisible,
  reconnectNonce,
  onStatusChange,
  onReconnectInfo,
  onContextMenu,
  onActionsReady,
  onSearchReady,
  onPasteImages,
}: XtermViewProps) {
  const { resolvedTheme } = useTheme();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const onStatusChangeRef = useRef(onStatusChange);
  const onReconnectInfoRef = useRef(onReconnectInfo);
  const onActionsReadyRef = useRef(onActionsReady);
  const onSearchReadyRef = useRef(onSearchReady);
  const onPasteImagesRef = useRef(onPasteImages);
  ...
  useEffect(() => { onPasteImagesRef.current = onPasteImages; }, [onPasteImages]);
```

- [ ] **Step 5: `write` を `TerminalActions` に組み込み、`paste` 経路も同じ write に統一**

`packages/web/src/components/terminal/XtermView.tsx:155-176` の `actions` 定義を以下に置き換える:

```ts
    const writeBytes = (text: string): boolean => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(encodeInput(text));
      return true;
    };

    const actions: TerminalActions = {
      copy: () => {
        const sel = term.getSelection();
        if (!sel) return;
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(sel).catch(() => undefined);
        }
      },
      paste: () => {
        if (!navigator.clipboard?.readText) return;
        void navigator.clipboard.readText().then((text) => {
          if (!text) return;
          writeBytes(text);
        }).catch(() => undefined);
      },
      clear: () => {
        term.clear();
      },
      write: writeBytes,
    };
    onActionsReadyRef.current?.(actions);
```

- [ ] **Step 6: `Ctrl+Shift+V` / `Cmd+Shift+V` の keydown ハンドラを書き換え**

MIME → 拡張子のマッピングを冒頭付近 (imports の下) に追加:

```ts
const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

function mimeToExt(mime: string): string {
  return IMAGE_MIME_EXT[mime] ?? 'bin';
}
```

`packages/web/src/components/terminal/XtermView.tsx:230-242` の `Ctrl+Shift+V` ブロックを以下に置き換える (Cmd+Shift+V も同条件で発火):

```ts
      // Ctrl/Cmd+Shift+V — paste from clipboard (image-aware)
      if (
        (ev.ctrlKey || ev.metaKey) &&
        ev.shiftKey &&
        (ev.key === 'V' || ev.key === 'v')
      ) {
        void (async () => {
          const clip = navigator.clipboard;
          if (clip?.read) {
            try {
              const items = await clip.read();
              const files: File[] = [];
              for (let i = 0; i < items.length; i += 1) {
                const item = items[i];
                const imageType = item.types.find((t) => t.startsWith('image/'));
                if (!imageType) continue;
                const blob = await item.getType(imageType);
                const ext = mimeToExt(imageType);
                files.push(
                  new File([blob], `image_${Date.now()}_${i}.${ext}`, { type: imageType }),
                );
              }
              if (files.length > 0) {
                onPasteImagesRef.current?.(files);
                return;
              }
            } catch {
              // NotAllowedError or other; fall through to text paste below
            }
          }
          if (clip?.readText) {
            try {
              const text = await clip.readText();
              if (!text) return;
              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(encodeInput(text));
              }
            } catch {
              /* noop */
            }
          }
        })();
        return false;
      }
```

- [ ] **Step 7: テスト全部 pass を確認**

Run: `cd packages/web && npx vitest run src/components/terminal/__tests__/XtermView.paste.test.tsx`
Expected: 4 PASS。

`cd packages/web && npx vitest run src/components/terminal/__tests__/` (既存テストへの regression なし) → 全 PASS。

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/components/terminal/XtermView.tsx packages/web/src/components/terminal/__tests__/XtermView.paste.test.tsx
git commit -m "feat(web): XtermView exposes write() and handles clipboard image paste"
```

---

## Task 7: `TerminalPane` で hook を組み立て、drop と paste を dispatch に流す

`TerminalPane` で `useImageDispatch` を呼んで `TerminalDropZone.onFiles` と `XtermView.onPasteImages` に同じ `dispatch` を接続する。`apiClient` を新 prop で受ける。

**Files:**
- Modify: `packages/web/src/components/TerminalPane.tsx`

- [ ] **Step 1: `TerminalPaneProps` を更新**

`packages/web/src/components/TerminalPane.tsx:28-48` を:

```ts
import type { ApiClient } from '@/api/client';
import type { UploadProgressApi } from '@/hooks/useUploadProgress';
import { useImageDispatch } from '@/hooks/useImageDispatch';

export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
  paneIndex: number;
  isFocused: boolean;
  isVisible: boolean;
  onSearch?: () => void;
  onNewPane?: () => void;
  canCreateNewPane?: boolean;
  apiClient: ApiClient | null;
  uploadProgress: UploadProgressApi;
}
```

(`sessionCwd`, `onDropFiles`, 既存 plain-object `uploadProgress` を削除し、フルの `UploadProgressApi` を受け取る。)

- [ ] **Step 2: 引数分解とローカル変数を更新**

同ファイルの関数本体の引数と冒頭 (`paneIndex` の void 直後) を:

```ts
export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  paneIndex,
  isFocused,
  isVisible,
  onSearch,
  onNewPane,
  canCreateNewPane = false,
  apiClient,
  uploadProgress,
}: TerminalPaneProps) {
  void paneIndex;
  const { tokens } = useTheme();
  const { t } = useTranslation();
  ...
  const pushToast = useUiStore((s) => s.pushToast);

  const actionsRef = useRef<TerminalActions | null>(null);
  const { dispatch } = useImageDispatch({
    apiClient,
    write: (text: string) => actionsRef.current?.write(text) ?? false,
    uploadProgress,
    pushToast,
    t,
  });

  const handleFiles = (files: File[]): void => {
    void dispatch(files);
  };
```

- [ ] **Step 3: JSX 内の `TerminalDropZone` と `XtermView` の配線を更新**

`packages/web/src/components/TerminalPane.tsx:183-199` 周辺を:

```tsx
          <XtermView
            gatewayUrl={gatewayUrl}
            token={token}
            sessionId={sessionId}
            windowIndex={windowIndex}
            isFocused={isFocused && isVisible}
            isVisible={isVisible}
            reconnectNonce={reconnectNonce}
            onStatusChange={setStatus}
            onReconnectInfo={setReconnectInfo}
            onContextMenu={(info) => setMenu(info)}
            onActionsReady={(a) => { actionsRef.current = a; }}
            onSearchReady={setSearchApi}
            onPasteImages={handleFiles}
          />
          {isFocused && apiClient && (
            <TerminalDropZone onFiles={handleFiles} />
          )}
          {isFocused && uploadProgress.active && (
            <div
              role="status"
              aria-live="polite"
              ...
            >
              ...
            </div>
          )}
```

(uploadProgress 表示部分の内側は変更不要。`uploadProgress?.active` → `uploadProgress.active` に変えるだけ。)

- [ ] **Step 4: 型チェックが通ることを確認**

Run: `cd packages/web && npx tsc --noEmit -p tsconfig.json`
Expected: エラー無し。一部は Task 8 で MultiPaneArea/AuthenticatedShell を更新するまでエラーが残るのが普通なので、TerminalPane 自体のエラーだけが消えていれば良い。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/TerminalPane.tsx
git commit -m "feat(web): wire useImageDispatch into TerminalPane for drop/paste"
```

---

## Task 8: `MultiPaneArea` と `AuthenticatedShell` の配線を更新

`onDropFiles` / `sessionCwd` 経路を廃止し、`apiClient` と `uploadProgress` を渡す。`handleTerminalDrop` を削除。

**Files:**
- Modify: `packages/web/src/components/layout/MultiPaneArea.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`

- [ ] **Step 1: `MultiPaneArea` の props を更新**

`packages/web/src/components/layout/MultiPaneArea.tsx` 全体を以下に置き換える:

```tsx
import { type CSSProperties, type ReactNode } from 'react';
import { TerminalPane } from '@/components/TerminalPane';
import { usePaneStore } from '@/stores/pane';
import type { LayoutMode } from '@/lib/paneLayout';
import type { ApiClient } from '@/api/client';
import type { UploadProgressApi } from '@/hooks/useUploadProgress';

export interface MultiPaneAreaProps {
  gatewayUrl: string;
  token: string;
  isVisible: boolean;
  onSearch?: () => void;
  onNewPane?: () => void;
  canCreateNewPane?: boolean;
  apiClient: ApiClient | null;
  uploadProgress: UploadProgressApi;
}

const GRID_TEMPLATE: Record<LayoutMode, Pick<CSSProperties, 'gridTemplateColumns' | 'gridTemplateRows'>> = {
  single: { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' },
  'cols-2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' },
  'cols-3': { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' },
  'grid-2x2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
};

export function MultiPaneArea({
  gatewayUrl,
  token,
  isVisible,
  onSearch,
  onNewPane,
  canCreateNewPane = false,
  apiClient,
  uploadProgress,
}: MultiPaneAreaProps) {
  const layout = usePaneStore((s) => s.layout);
  const panes = usePaneStore((s) => s.panes);
  const focusedIndex = usePaneStore((s) => s.focusedIndex);
  const setFocusedIndex = usePaneStore((s) => s.setFocusedIndex);

  const slot = (idx: number): ReactNode => {
    const pane = panes[idx];
    return (
      <div
        key={`pane-${idx}`}
        onClick={() => setFocusedIndex(idx)}
        style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
      >
        <TerminalPane
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={pane?.sessionId ?? null}
          windowIndex={pane?.windowIndex ?? null}
          paneIndex={idx}
          isFocused={idx === focusedIndex}
          isVisible={isVisible}
          onSearch={onSearch}
          onNewPane={onNewPane}
          canCreateNewPane={canCreateNewPane}
          apiClient={apiClient}
          uploadProgress={uploadProgress}
        />
      </div>
    );
  };

  const slotCount = layout === 'single' ? 1 : layout === 'cols-2' ? 2 : layout === 'cols-3' ? 3 : 4;
  const slots: ReactNode[] = [];
  for (let i = 0; i < slotCount; i += 1) slots.push(slot(i));

  return (
    <div
      style={{
        display: 'grid',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...GRID_TEMPLATE[layout],
      }}
    >
      {slots}
    </div>
  );
}
```

- [ ] **Step 2: `AuthenticatedShell` から `handleTerminalDrop` を削除**

`packages/web/src/components/AuthenticatedShell.tsx:168-190` (`handleTerminalDrop` 関数定義) を**まるごと削除**。

- [ ] **Step 3: `MultiPaneArea` 呼び出し箇所を更新**

`packages/web/src/components/AuthenticatedShell.tsx:451-466` を以下に置き換える:

```tsx
          <MultiPaneArea
            gatewayUrl={gatewayUrl}
            token={token}
            isVisible={!isFilesRoute}
            onSearch={() => useLayoutStore.getState().openSearch()}
            onNewPane={newPaneFromCurrent}
            canCreateNewPane={canCreateNewPane}
            apiClient={baseClient}
            uploadProgress={uploadProgress}
          />
```

- [ ] **Step 4: TypeScript 全体型チェック**

Run: `cd packages/web && npx tsc --noEmit -p tsconfig.json`
Expected: エラー無し。

- [ ] **Step 5: ユニットテスト全体を再走**

Run: `cd packages/web && npx vitest run`
Expected: 全 PASS。

事前調査により `web/src/` 配下のユニットテストで `sessionCwd` / `onDropFiles` / `uploadProgress` を直接参照しているテストは無いことを確認済み。万一 props 不整合の TS エラーが出た場合は、該当テストの `TerminalPane` レンダリング箇所に `apiClient={null}` と `uploadProgress={makeProgress()}` (Task 4 のテストヘルパと同等) を補えば良い。

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/layout/MultiPaneArea.tsx packages/web/src/components/AuthenticatedShell.tsx packages/web/src/components/__tests__/
git commit -m "refactor(web): drop cwd-aware drop wiring; thread apiClient down to TerminalPane"
```

---

## Task 9: 既存 e2e `phase5-coverage.spec.ts` の drop 検証を staging 用に更新

「ドロップで cwd に upload」を検証するテストを「ドロップで staging に upload + xterm にパスが表示される」に書き換える。

**Files:**
- Modify: `tests/e2e/web/phase5-coverage.spec.ts:170-229`

- [ ] **Step 1: 既存ブロックを置き換え**

`tests/e2e/web/phase5-coverage.spec.ts:170-229` を以下で置き換える:

```ts
// ---------------------------------------------------------------------------
// Test 2: File drop on terminal pane uploads to staging and types the path
//
// After the unification in 2026-05-14-web-image-dispatch-design.md, terminal
// pane drops go to $HOME/uploads/zenterm/ (staging), and the absolute path is
// shell-quoted and typed into the pty. The toast still says "Uploaded 1 file".
// ---------------------------------------------------------------------------
test('file drop on terminal pane uploads to staging and shows upload-done toast', async ({ page }) => {
  const sessionId = await createSession();
  if (!sessionId) { test.skip(); return; }

  await navigateToSession(page, sessionId);
  await page.waitForTimeout(2000);

  const dropResult = await page.evaluate(async () => {
    function makeDragEvent(type: string, dt: DataTransfer): DragEvent {
      return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
    }
    const dt = new DataTransfer();
    dt.items.add(new File(['hello world'], 'test-drop.txt', { type: 'text/plain' }));
    window.dispatchEvent(makeDragEvent('dragenter', dt));
    window.dispatchEvent(makeDragEvent('dragover', dt));
    await new Promise((r) => setTimeout(r, 300));
    const dropZone = Array.from(document.querySelectorAll<HTMLElement>('[role="region"]')).find(
      (el) => el.style.zIndex === '50',
    );
    if (!dropZone) return { found: false };
    dropZone.dispatchEvent(makeDragEvent('drop', dt));
    return { found: true };
  });

  if (!dropResult.found) { test.skip(); return; }

  // Toast: "Uploaded 1 file(s)".
  const toast = page.locator('[role="status"]').filter({ hasText: /Uploaded 1 file/i }).first();
  await expect(toast).toBeVisible({ timeout: 10000 });

  // The terminal screen should contain a path under uploads/zenterm/ (echo from pty).
  const screen = page.locator('.xterm-screen').first();
  await expect(screen).toContainText(/uploads\/zenterm\//, { timeout: 10000 });
});
```

- [ ] **Step 2: spec をビルド + Docker 隔離 e2e で実行**

Run: `ZENTERM_E2E_NO_BUILD=1 scripts/e2e-docker.sh tests/e2e/web/phase5-coverage.spec.ts`
Expected: 全テスト PASS。
※ image 再ビルドが必要なら `scripts/e2e-docker.sh tests/e2e/web/phase5-coverage.spec.ts` を一度実行する。

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/phase5-coverage.spec.ts
git commit -m "test(e2e): adapt drop spec to staging-and-type-path behavior"
```

---

## Task 10: 新規 e2e `image-drop.spec.ts`

複数画像ドロップで staging に N 個保存され、ターミナルにシェル引用付きで N path が出ることを検証。

**Files:**
- Create: `tests/e2e/web/image-drop.spec.ts`

- [ ] **Step 1: spec を作成**

Create `tests/e2e/web/image-drop.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createSession, navigateToSession } from './helpers';

test('drop two images: staging + two quoted paths typed into pty', async ({ page }) => {
  const sessionId = await createSession();
  if (!sessionId) { test.skip(); return; }

  await navigateToSession(page, sessionId);
  await page.waitForTimeout(2000);

  const dropResult = await page.evaluate(async () => {
    function makeDragEvent(type: string, dt: DataTransfer): DragEvent {
      return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
    }
    // Minimal valid 1x1 PNG (89 50 4E 47 …) — only the magic header is needed for the test.
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    const dt = new DataTransfer();
    dt.items.add(new File([pngBytes], 'a.png', { type: 'image/png' }));
    dt.items.add(new File([pngBytes], 'b.png', { type: 'image/png' }));
    window.dispatchEvent(makeDragEvent('dragenter', dt));
    window.dispatchEvent(makeDragEvent('dragover', dt));
    await new Promise((r) => setTimeout(r, 300));
    const dropZone = Array.from(document.querySelectorAll<HTMLElement>('[role="region"]')).find(
      (el) => el.style.zIndex === '50',
    );
    if (!dropZone) return { found: false };
    dropZone.dispatchEvent(makeDragEvent('drop', dt));
    return { found: true };
  });

  if (!dropResult.found) { test.skip(); return; }

  const toast = page.locator('[role="status"]').filter({ hasText: /Uploaded 2 file/i }).first();
  await expect(toast).toBeVisible({ timeout: 15000 });

  const screen = page.locator('.xterm-screen').first();
  // After echo, both paths should show inside the buffer. Count `uploads/zenterm/` occurrences.
  await expect(screen).toContainText(/uploads\/zenterm\/.+uploads\/zenterm\//s, { timeout: 15000 });
});
```

- [ ] **Step 2: Docker 隔離 e2e で実行**

Run: `ZENTERM_E2E_NO_BUILD=1 scripts/e2e-docker.sh tests/e2e/web/image-drop.spec.ts`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/image-drop.spec.ts
git commit -m "test(e2e): drop two images yields staging upload + two paths in pty"
```

---

## Task 11: 新規 e2e `image-paste.spec.ts`

`Ctrl+Shift+V` でクリップボード画像をペーストするフローを検証。Chromium 限定で動作。

**Files:**
- Create: `tests/e2e/web/image-paste.spec.ts`

- [ ] **Step 1: spec を作成**

Create `tests/e2e/web/image-paste.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createSession, navigateToSession } from './helpers';

test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
});

test('Ctrl+Shift+V with a clipboard image uploads to staging and types the path', async ({ page, context }) => {
  // Some browsers / contexts may not honor permissions for clipboard.write; skip if so.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const sessionId = await createSession();
  if (!sessionId) { test.skip(); return; }

  await navigateToSession(page, sessionId);
  await page.waitForTimeout(2000);

  // Put a tiny PNG into the clipboard.
  const placed = await page.evaluate(async () => {
    if (!('write' in (navigator.clipboard ?? {}))) return false;
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      return false;
    }
  });

  if (!placed) { test.skip(); return; }

  // Focus a terminal pane.
  await page.locator('section[data-terminal-root]').first().click({ position: { x: 100, y: 100 } });

  // Fire Ctrl+Shift+V; xterm intercepts via attachCustomKeyEventHandler.
  await page.keyboard.press('Control+Shift+V');

  const toast = page.locator('[role="status"]').filter({ hasText: /Uploaded 1 file/i }).first();
  await expect(toast).toBeVisible({ timeout: 15000 });

  const screen = page.locator('.xterm-screen').first();
  await expect(screen).toContainText(/uploads\/zenterm\//, { timeout: 15000 });
});
```

- [ ] **Step 2: Docker 隔離 e2e で実行**

Run: `ZENTERM_E2E_NO_BUILD=1 scripts/e2e-docker.sh tests/e2e/web/image-paste.spec.ts`
Expected: PASS。

clipboard permission の制約で skip になる場合: `playwright.config.ts` で `permissions: ['clipboard-read', 'clipboard-write']` がデフォルト適用されているか確認。されていなければ spec 内の `test.use` が効くはず。それでも skip するなら手動検証チェックリストに移し、e2e はスキップを許容する。

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/image-paste.spec.ts
git commit -m "test(e2e): Ctrl+Shift+V image paste uploads to staging and types path"
```

---

## Final: 全テスト + 全 e2e のリグレッション確認

- [ ] **Step 1: 全ユニットテスト**

Run: `cd packages/web && npx vitest run`
Expected: 全 PASS。

- [ ] **Step 2: 全 Docker 隔離 e2e**

Run: `scripts/e2e-docker.sh`
Expected: 全 spec PASS (約 49 件、~1 分)。

- [ ] **Step 3: 手動検証チェックリスト** (spec §7.3)

1. Chrome で起動 → 画像ファイル 1 枚をペインにドロップ → staging に保存され、絶対パスが xterm に表示される。
2. `Cmd+Shift+V` (macOS) / `Ctrl+Shift+V` (Linux) でスクリーンショットペースト → 同上。
3. 画像 3 枚同時ドロップ → スペース区切りで 3 path が表示される。
4. テキストだけ含むクリップボードで Ctrl+Shift+V → 従来通りテキストが入る。
5. Claude Code 起動中のペインにドロップ → Claude Code がパスを認識し画像を読込む。
6. アップロード中に別ペインにドロップ → `uploadBusy` トーストが出る。
7. クリップボード権限が拒否された状態で Ctrl+Shift+V → テキストパスにフォールバック。
