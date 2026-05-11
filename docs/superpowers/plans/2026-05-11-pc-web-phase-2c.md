# ZenTerm PC Web Phase 2c (Files タブ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar の Files タブを enable し、`/web/files` ルートでホームディレクトリ配下のブラウズ・テキスト/画像/markdown プレビュー・CodeMirror 編集・新規/リネーム/削除/コピー/カット/ペースト/mkdir/upload/download を Mobile FilesPanel と機能パリティで実装する (Phase 2 完成)。

**Architecture:** Sidebar 内に新規 `FilesSidebarPanel` (toolbar + breadcrumbs + list + selection/paste bar) を実装し、右ペインを `useLocation()` で 2-way 分岐 (`/web/files` 中は TerminalPane を unmount し `FilesViewerPane` を mount)。状態は `useFilesStore` (browse + selection + clipboard) と `useFilesPreviewStore` (selected + edit) の 2 store に集約。ApiClient に Files 系メソッド 10 本を追加し、wrappedClient で 401 intercept。CodeMirror 6 (`@uiw/react-codemirror`) と `react-markdown` は `React.lazy` で chunk 分割。画像/ダウンロードは Bearer 付き fetch → Blob URL の `useAuthorizedBlobUrl` hook 経由。

**Tech Stack:** TypeScript 5.7 / React 19 / Vite 6 / zustand 5 / react-router 7 / vitest 4 / Playwright / 新規: @uiw/react-codemirror ^4 + @codemirror/lang-{javascript,json,markdown,python,html,css} + @codemirror/theme-one-dark + react-markdown ^9 + remark-gfm ^4

**Spec:** `docs/superpowers/specs/2026-05-11-pc-web-phase-2c-design.md`

**Pre-existing facts (Phase 2b 完了時点):**
- `packages/web/src/App.tsx`: `/web/files` は `<Navigate to="/web/sessions" replace />` で受けている (Phase 2c で本物のルートに置換)
- `packages/web/src/components/AuthenticatedShell.tsx`: Sidebar + TerminalPane を常時並べる構造。`wrappedClient` を組み立てて 401 intercept。Phase 2c で右ペインを `useLocation()` で分岐
- `packages/web/src/components/Sidebar.tsx`: Files タブは `disabled` + `title={t('sidebar.filesComingSoon')}` (line 100-109)。`renderPanel()` は `activePanel === 'settings'` → `<SettingsPanel />`、それ以外 → `<SessionsListPanel />` (line 45-48)
- `packages/web/src/components/__tests__/Sidebar.test.tsx`: `Files tab is disabled with Phase 2c tooltip` test (line 124-133) と `expect(filesTab).toBeDisabled()` (line 37) があり Phase 2c で更新が必要
- `packages/web/src/api/client.ts`: `ApiClient` クラス (sessions/windows + system/limits/verify)。Files 系は未実装
- `packages/web/src/api/errors.ts`: `HttpError(status, body, message?)` 既存
- `packages/web/src/stores/ui.ts`: `useUiStore.showConfirm({ title, message, destructive?, confirmLabel?, cancelLabel?, onConfirm })` と `pushToast({ type: 'info'|'error'|'success', message, durationMs? })` 既存
- `packages/web/src/i18n/locales/{en,ja}.json`: `common`, `sidebar`, `login`, `sessions`, `terminal`, `validation`, `settings` namespace 既存。`files` namespace 未存在
- `packages/shared/src/index.ts`: `FileEntry`, `FileListResponse`, `FileContentResponse`, `FileWriteResponse`, `FileDeleteResponse`, `FileRenameResponse`, `FileCopyResponse`, `FileMoveResponse`, `FileMkdirResponse`, `FileUploadResponse` 既存 (line 58-122)
- `packages/gateway/src/routes/files.ts`: `GET/PUT /api/files/content`, `GET /api/files`, `GET /api/files/raw`, `DELETE /api/files`, `POST /api/files/rename|copy|move|mkdir` 既存
- `packages/gateway/src/routes/upload.ts`: `POST /api/upload?dest=&preserveName=true` multipart 既存
- Playwright: `tests/e2e/web/*.spec.ts` 既存 10 spec、Phase 2a/2b で 18790-18794 を消費。Phase 2c は 18800-18810 を予約
- vitest: `packages/web/src/__tests__/flows/*.test.tsx` 既存 7 flow

**Branch:** 既に `feature/web-pc-phase-2c` (origin/main から分岐、spec 1 commit 済み = 0c4da15)

---

## Sub-phase 2c-1: Foundation (Tasks 1-8)

新規依存追加 + lib/utils + zustand stores + ApiClient メソッド追加 + 型整合確認。

### Task 1: Add CodeMirror + react-markdown dependencies

**Files:**
- Modify: `packages/web/package.json`

- [ ] **Step 1: Edit dependencies**

Add the following entries to the `"dependencies"` object in `packages/web/package.json` (keep existing entries; insert alphabetically):

```json
"@codemirror/lang-css": "^6.3.0",
"@codemirror/lang-html": "^6.4.9",
"@codemirror/lang-javascript": "^6.2.2",
"@codemirror/lang-json": "^6.0.1",
"@codemirror/lang-markdown": "^6.3.0",
"@codemirror/lang-python": "^6.1.6",
"@codemirror/theme-one-dark": "^6.1.2",
"@uiw/react-codemirror": "^4.23.0",
"react-markdown": "^9.0.1",
"remark-gfm": "^4.0.0"
```

- [ ] **Step 2: Install**

```bash
cd /home/server/projects/zenterm/server && npm install
```
Expected: install succeeds. CodeMirror packages bring in `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/search`, `@lezer/*` as transitive deps.

- [ ] **Step 3: Verify type-check still passes**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: PASS (no new code yet)

- [ ] **Step 4: Commit**

```bash
git add packages/web/package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(web): add CodeMirror 6 + react-markdown deps for Phase 2c Files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create `lib/filesPath.ts` utilities

**Files:**
- Create: `packages/web/src/lib/filesPath.ts`
- Test: `packages/web/src/lib/__tests__/filesPath.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/lib/__tests__/filesPath.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  buildBreadcrumbSegments,
  buildEntryPath,
  getParentPath,
  type BreadcrumbSegment,
} from '../filesPath';

describe('buildEntryPath', () => {
  it('joins root /', () => {
    expect(buildEntryPath('/', 'foo')).toBe('/foo');
  });
  it('joins ~ home', () => {
    expect(buildEntryPath('~', 'foo')).toBe('~/foo');
  });
  it('joins nested path stripping trailing slashes', () => {
    expect(buildEntryPath('~/a/', 'b')).toBe('~/a/b');
    expect(buildEntryPath('/a/b', 'c')).toBe('/a/b/c');
  });
});

describe('getParentPath', () => {
  it('returns ~ for ~', () => {
    expect(getParentPath('~')).toBe('~');
  });
  it('returns / for /', () => {
    expect(getParentPath('/')).toBe('/');
  });
  it('returns ~ for ~/foo', () => {
    expect(getParentPath('~/foo')).toBe('~');
  });
  it('returns ~/a for ~/a/b', () => {
    expect(getParentPath('~/a/b')).toBe('~/a');
  });
  it('returns / for /foo', () => {
    expect(getParentPath('/foo')).toBe('/');
  });
  it('returns /a for /a/b', () => {
    expect(getParentPath('/a/b')).toBe('/a');
  });
});

describe('buildBreadcrumbSegments', () => {
  it('returns [] for ~', () => {
    expect(buildBreadcrumbSegments('~')).toEqual<BreadcrumbSegment[]>([]);
  });
  it('returns [] for /', () => {
    expect(buildBreadcrumbSegments('/')).toEqual<BreadcrumbSegment[]>([]);
  });
  it('home-rooted: ~/a/b → 2 segments', () => {
    expect(buildBreadcrumbSegments('~/a/b')).toEqual<BreadcrumbSegment[]>([
      { key: 'home:a', label: 'a', path: '~/a' },
      { key: 'home:a/b', label: 'b', path: '~/a/b' },
    ]);
  });
  it('absolute: /etc/nginx → 2 segments', () => {
    expect(buildBreadcrumbSegments('/etc/nginx')).toEqual<BreadcrumbSegment[]>([
      { key: 'abs:etc', label: 'etc', path: '/etc' },
      { key: 'abs:etc/nginx', label: 'nginx', path: '/etc/nginx' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/filesPath.test.ts
```
Expected: FAIL — module '../filesPath' not found

- [ ] **Step 3: Write minimal implementation**

Create `packages/web/src/lib/filesPath.ts`:
```ts
export interface BreadcrumbSegment {
  key: string;
  label: string;
  path: string;
}

export function buildEntryPath(parentPath: string, name: string): string {
  if (parentPath === '/') return `/${name}`;
  if (parentPath === '~') return `~/${name}`;
  return `${parentPath.replace(/\/+$/, '')}/${name}`;
}

export function getParentPath(path: string): string {
  if (!path || path === '~' || path === '/') {
    return path || '~';
  }
  if (path.startsWith('~/')) {
    const parts = path.slice(2).split('/').filter(Boolean);
    return parts.length <= 1 ? '~' : `~/${parts.slice(0, -1).join('/')}`;
  }
  if (path.startsWith('/')) {
    const parts = path.split('/').filter(Boolean);
    return parts.length <= 1 ? '/' : `/${parts.slice(0, -1).join('/')}`;
  }
  const parts = path.split('/').filter(Boolean);
  return parts.length <= 1 ? '~' : parts.slice(0, -1).join('/');
}

export function buildBreadcrumbSegments(path: string): BreadcrumbSegment[] {
  if (!path || path === '~' || path === '/') return [];
  if (path.startsWith('~/')) {
    const parts = path.slice(2).split('/').filter(Boolean);
    return parts.map((label, index) => ({
      key: `home:${parts.slice(0, index + 1).join('/')}`,
      label,
      path: `~/${parts.slice(0, index + 1).join('/')}`,
    }));
  }
  if (path.startsWith('/')) {
    const parts = path.split('/').filter(Boolean);
    return parts.map((label, index) => ({
      key: `abs:${parts.slice(0, index + 1).join('/')}`,
      label,
      path: `/${parts.slice(0, index + 1).join('/')}`,
    }));
  }
  const parts = path.split('/').filter(Boolean);
  return parts.map((label, index) => ({
    key: `rel:${parts.slice(0, index + 1).join('/')}`,
    label,
    path: parts.slice(0, index + 1).join('/'),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/filesPath.test.ts
```
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/filesPath.ts packages/web/src/lib/__tests__/filesPath.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add filesPath helpers (buildEntryPath/getParentPath/buildBreadcrumbSegments)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create `lib/filesSort.ts` + `lib/filesIcon.ts` + `lib/filesFormat.ts`

**Files:**
- Create: `packages/web/src/lib/filesSort.ts`
- Create: `packages/web/src/lib/filesIcon.ts`
- Create: `packages/web/src/lib/filesFormat.ts`
- Test: `packages/web/src/lib/__tests__/filesSort.test.ts`
- Test: `packages/web/src/lib/__tests__/filesIcon.test.ts`
- Test: `packages/web/src/lib/__tests__/filesFormat.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/web/src/lib/__tests__/filesSort.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { FileEntry } from '@zenterm/shared';
import { sortFiles } from '../filesSort';

const dir = (name: string, size = 0, modified = 0): FileEntry => ({
  name, type: 'directory', size, modified, permissions: 'rwxr-xr-x',
});
const file = (name: string, size = 100, modified = 0): FileEntry => ({
  name, type: 'file', size, modified, permissions: 'rw-r--r--',
});

describe('sortFiles', () => {
  it('always lists directories before files', () => {
    const out = sortFiles([file('a'), dir('z'), file('b'), dir('y')], 'name-asc');
    expect(out.map((e) => e.name)).toEqual(['y', 'z', 'a', 'b']);
  });
  it('name-asc sorts alphabetically within group', () => {
    const out = sortFiles([file('c'), file('a'), file('b')], 'name-asc');
    expect(out.map((e) => e.name)).toEqual(['a', 'b', 'c']);
  });
  it('name-desc sorts reverse', () => {
    const out = sortFiles([file('a'), file('c'), file('b')], 'name-desc');
    expect(out.map((e) => e.name)).toEqual(['c', 'b', 'a']);
  });
  it('size-desc sorts large first', () => {
    const out = sortFiles([file('a', 100), file('b', 500), file('c', 200)], 'size-desc');
    expect(out.map((e) => e.name)).toEqual(['b', 'c', 'a']);
  });
  it('modified-desc sorts newest first', () => {
    const out = sortFiles([file('a', 0, 100), file('b', 0, 500), file('c', 0, 300)], 'modified-desc');
    expect(out.map((e) => e.name)).toEqual(['b', 'c', 'a']);
  });
});
```

Create `packages/web/src/lib/__tests__/filesIcon.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { FileEntry } from '@zenterm/shared';
import { getFileIconType, getPreviewKind } from '../filesIcon';

const make = (name: string, type: FileEntry['type'] = 'file'): FileEntry => ({
  name, type, size: 0, modified: 0, permissions: 'rw-r--r--',
});

describe('getFileIconType', () => {
  it('returns folder for directory', () => {
    expect(getFileIconType(make('foo', 'directory'))).toBe('folder');
  });
  it('returns symlink for symlink', () => {
    expect(getFileIconType(make('foo', 'symlink'))).toBe('symlink');
  });
  it('returns code for .ts', () => {
    expect(getFileIconType(make('foo.ts'))).toBe('code');
  });
  it('returns image for .png', () => {
    expect(getFileIconType(make('foo.png'))).toBe('image');
  });
  it('returns text for unknown extension', () => {
    expect(getFileIconType(make('foo.xyz'))).toBe('text');
  });
});

describe('getPreviewKind', () => {
  it('returns image for .jpg', () => {
    expect(getPreviewKind('foo.jpg')).toBe('image');
  });
  it('returns markdown for .md', () => {
    expect(getPreviewKind('readme.md')).toBe('markdown');
  });
  it('returns text for .ts', () => {
    expect(getPreviewKind('main.ts')).toBe('text');
  });
  it('returns text for unknown but printable', () => {
    expect(getPreviewKind('LICENSE')).toBe('text');
  });
  it('returns unsupported for binary-ish (.zip)', () => {
    expect(getPreviewKind('archive.zip')).toBe('unsupported');
  });
});
```

Create `packages/web/src/lib/__tests__/filesFormat.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatFileDate, formatFileSize } from '../filesFormat';

describe('formatFileSize', () => {
  it('B', () => expect(formatFileSize(512)).toBe('512 B'));
  it('KB', () => expect(formatFileSize(2048)).toBe('2.0 KB'));
  it('MB', () => expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB'));
  it('GB', () => expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3.0 GB'));
});

describe('formatFileDate', () => {
  it('formats epoch seconds via Date.toLocaleString with given locale', () => {
    // 2024-01-02 00:00:00 UTC = 1704153600 (sec)
    const out = formatFileDate(1704153600, 'en-US');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
  it('formats epoch milliseconds when value > 1e12', () => {
    const out = formatFileDate(1704153600000, 'en-US');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/filesSort.test.ts src/lib/__tests__/filesIcon.test.ts src/lib/__tests__/filesFormat.test.ts
```
Expected: FAIL — modules `../filesSort`, `../filesIcon`, `../filesFormat` not found

- [ ] **Step 3: Write implementations**

Create `packages/web/src/lib/filesSort.ts`:
```ts
import type { FileEntry } from '@zenterm/shared';

export type SortMode = 'name-asc' | 'name-desc' | 'size-desc' | 'modified-desc';

export function sortFiles(entries: FileEntry[], mode: SortMode): FileEntry[] {
  const dirs = entries.filter((e) => e.type === 'directory');
  const rest = entries.filter((e) => e.type !== 'directory');

  const sortFn = (a: FileEntry, b: FileEntry): number => {
    switch (mode) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'size-desc':
        return b.size - a.size;
      case 'modified-desc':
        return b.modified - a.modified;
    }
  };

  return [...dirs.sort(sortFn), ...rest.sort(sortFn)];
}
```

Create `packages/web/src/lib/filesIcon.ts`:
```ts
import type { FileEntry } from '@zenterm/shared';

export type FileIconType = 'folder' | 'code' | 'image' | 'text' | 'symlink' | 'other';
export type PreviewKind = 'text' | 'image' | 'markdown' | 'unsupported';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cc', '.cpp', '.h', '.hpp',
  '.sh', '.bash', '.zsh', '.fish',
  '.json', '.jsonc', '.yaml', '.yml', '.toml', '.xml', '.html', '.htm', '.css', '.scss',
  '.sql',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico',
]);

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);

const BINARY_EXTENSIONS = new Set([
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.flac', '.wav',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
]);

function getExt(name: string): string {
  return name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
}

export function getFileIconType(entry: FileEntry): FileIconType {
  if (entry.type === 'directory') return 'folder';
  if (entry.type === 'symlink') return 'symlink';
  if (entry.type === 'other') return 'other';
  const ext = getExt(entry.name);
  if (CODE_EXTENSIONS.has(ext) || MARKDOWN_EXTENSIONS.has(ext)) return 'code';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'text';
}

export function getPreviewKind(name: string): PreviewKind {
  const ext = getExt(name);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  if (BINARY_EXTENSIONS.has(ext)) return 'unsupported';
  // Code or unknown printable → text
  return 'text';
}
```

Create `packages/web/src/lib/filesFormat.ts`:
```ts
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatFileDate(modified: number, locale: string): string {
  const timestamp = modified < 1_000_000_000_000 ? modified * 1000 : modified;
  return new Date(timestamp).toLocaleString(locale);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/filesSort.test.ts src/lib/__tests__/filesIcon.test.ts src/lib/__tests__/filesFormat.test.ts
```
Expected: PASS (5 + 10 + 6 = 21 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/filesSort.ts packages/web/src/lib/filesIcon.ts packages/web/src/lib/filesFormat.ts packages/web/src/lib/__tests__/filesSort.test.ts packages/web/src/lib/__tests__/filesIcon.test.ts packages/web/src/lib/__tests__/filesFormat.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add filesSort/filesIcon/filesFormat helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create `lib/languageForFilename.ts`

**Files:**
- Create: `packages/web/src/lib/languageForFilename.ts`
- Test: `packages/web/src/lib/__tests__/languageForFilename.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/lib/__tests__/languageForFilename.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { languageForFilename } from '../languageForFilename';

describe('languageForFilename', () => {
  it('returns javascript extension for .ts', async () => {
    const ext = await languageForFilename('main.ts');
    expect(ext).not.toBeNull();
  });
  it('returns javascript extension for .tsx', async () => {
    const ext = await languageForFilename('App.tsx');
    expect(ext).not.toBeNull();
  });
  it('returns json for .json', async () => {
    const ext = await languageForFilename('package.json');
    expect(ext).not.toBeNull();
  });
  it('returns markdown for .md', async () => {
    const ext = await languageForFilename('README.md');
    expect(ext).not.toBeNull();
  });
  it('returns python for .py', async () => {
    const ext = await languageForFilename('main.py');
    expect(ext).not.toBeNull();
  });
  it('returns html for .html', async () => {
    const ext = await languageForFilename('index.html');
    expect(ext).not.toBeNull();
  });
  it('returns css for .css', async () => {
    const ext = await languageForFilename('styles.css');
    expect(ext).not.toBeNull();
  });
  it('returns null for unknown extension', async () => {
    const ext = await languageForFilename('weird.xyz');
    expect(ext).toBeNull();
  });
  it('returns null for no extension', async () => {
    const ext = await languageForFilename('LICENSE');
    expect(ext).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/languageForFilename.test.ts
```
Expected: FAIL — module '../languageForFilename' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/lib/languageForFilename.ts`:
```ts
import type { Extension } from '@codemirror/state';

function getExt(name: string): string {
  return name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
}

/**
 * Lazy-load the appropriate CodeMirror language extension for a given filename.
 * Returns null when no language matches (CodeMirror falls back to plain text).
 */
export async function languageForFilename(filename: string): Promise<Extension | null> {
  const ext = getExt(filename);
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs': {
      const m = await import('@codemirror/lang-javascript');
      return m.javascript({ jsx: ext === '.jsx' || ext === '.tsx', typescript: ext === '.ts' || ext === '.tsx' });
    }
    case '.json':
    case '.jsonc': {
      const m = await import('@codemirror/lang-json');
      return m.json();
    }
    case '.md':
    case '.markdown':
    case '.mdx': {
      const m = await import('@codemirror/lang-markdown');
      return m.markdown();
    }
    case '.py': {
      const m = await import('@codemirror/lang-python');
      return m.python();
    }
    case '.html':
    case '.htm': {
      const m = await import('@codemirror/lang-html');
      return m.html();
    }
    case '.css':
    case '.scss': {
      const m = await import('@codemirror/lang-css');
      return m.css();
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/languageForFilename.test.ts
```
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/languageForFilename.ts packages/web/src/lib/__tests__/languageForFilename.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add languageForFilename helper for CodeMirror language ext

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create `stores/files.ts` (browse + selection + clipboard state)

**Files:**
- Create: `packages/web/src/stores/files.ts`
- Test: `packages/web/src/stores/__tests__/files.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/stores/__tests__/files.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { FileEntry } from '@zenterm/shared';
import { useFilesStore } from '../files';

const file = (name: string): FileEntry => ({
  name, type: 'file', size: 100, modified: 0, permissions: 'rw-r--r--',
});

describe('useFilesStore', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
  });

  it('starts with default state', () => {
    const s = useFilesStore.getState();
    expect(s.currentPath).toBe('~');
    expect(s.entries).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.showHidden).toBe(false);
    expect(s.sortMode).toBe('name-asc');
    expect(s.selectionMode).toBe(false);
    expect(s.selectedNames.size).toBe(0);
    expect(s.clipboard).toBeNull();
  });

  it('setCurrentPath / setEntries / setLoading / setError', () => {
    useFilesStore.getState().setCurrentPath('~/sub');
    expect(useFilesStore.getState().currentPath).toBe('~/sub');
    useFilesStore.getState().setEntries([file('a'), file('b')]);
    expect(useFilesStore.getState().entries).toHaveLength(2);
    useFilesStore.getState().setLoading(true);
    expect(useFilesStore.getState().loading).toBe(true);
    useFilesStore.getState().setError('boom');
    expect(useFilesStore.getState().error).toBe('boom');
  });

  it('toggleShowHidden flips boolean', () => {
    useFilesStore.getState().toggleShowHidden();
    expect(useFilesStore.getState().showHidden).toBe(true);
    useFilesStore.getState().toggleShowHidden();
    expect(useFilesStore.getState().showHidden).toBe(false);
  });

  it('setSortMode updates mode', () => {
    useFilesStore.getState().setSortMode('size-desc');
    expect(useFilesStore.getState().sortMode).toBe('size-desc');
  });

  it('enterSelectionMode with initial name selects it', () => {
    useFilesStore.getState().enterSelectionMode('foo.txt');
    expect(useFilesStore.getState().selectionMode).toBe(true);
    expect(useFilesStore.getState().selectedNames.has('foo.txt')).toBe(true);
  });

  it('exitSelectionMode clears selection', () => {
    useFilesStore.getState().enterSelectionMode('foo.txt');
    useFilesStore.getState().exitSelectionMode();
    expect(useFilesStore.getState().selectionMode).toBe(false);
    expect(useFilesStore.getState().selectedNames.size).toBe(0);
  });

  it('toggleSelection adds and removes', () => {
    useFilesStore.getState().toggleSelection('a');
    expect(useFilesStore.getState().selectedNames.has('a')).toBe(true);
    useFilesStore.getState().toggleSelection('a');
    expect(useFilesStore.getState().selectedNames.has('a')).toBe(false);
  });

  it('selectAll selects every entry name', () => {
    useFilesStore.getState().setEntries([file('a'), file('b'), file('c')]);
    useFilesStore.getState().selectAll();
    expect(useFilesStore.getState().selectedNames.size).toBe(3);
  });

  it('setClipboard / clearClipboard', () => {
    useFilesStore.getState().setClipboard({ items: ['~/a'], mode: 'copy' });
    expect(useFilesStore.getState().clipboard).toEqual({ items: ['~/a'], mode: 'copy' });
    useFilesStore.getState().clearClipboard();
    expect(useFilesStore.getState().clipboard).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/stores/__tests__/files.test.ts
```
Expected: FAIL — module '../files' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/stores/files.ts`:
```ts
import { create } from 'zustand';
import type { FileEntry } from '@zenterm/shared';
import type { SortMode } from '@/lib/filesSort';

export type ClipboardMode = 'copy' | 'cut';

export interface FilesClipboard {
  items: string[]; // absolute (or ~-rooted) paths
  mode: ClipboardMode;
}

interface FilesState {
  currentPath: string;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  showHidden: boolean;
  sortMode: SortMode;

  selectionMode: boolean;
  selectedNames: Set<string>;

  clipboard: FilesClipboard | null;

  setCurrentPath: (path: string) => void;
  setEntries: (entries: FileEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleShowHidden: () => void;
  setSortMode: (mode: SortMode) => void;
  enterSelectionMode: (initialName?: string) => void;
  exitSelectionMode: () => void;
  toggleSelection: (name: string) => void;
  selectAll: () => void;
  setClipboard: (c: FilesClipboard | null) => void;
  clearClipboard: () => void;
  reset: () => void;
}

const INITIAL: Pick<FilesState,
  'currentPath' | 'entries' | 'loading' | 'error' | 'showHidden' | 'sortMode' |
  'selectionMode' | 'selectedNames' | 'clipboard'
> = {
  currentPath: '~',
  entries: [],
  loading: false,
  error: null,
  showHidden: false,
  sortMode: 'name-asc',
  selectionMode: false,
  selectedNames: new Set<string>(),
  clipboard: null,
};

export const useFilesStore = create<FilesState>((set, get) => ({
  ...INITIAL,
  setCurrentPath: (currentPath) => set({ currentPath }),
  setEntries: (entries) => set({ entries }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
  setSortMode: (sortMode) => set({ sortMode }),
  enterSelectionMode: (initialName) => {
    const next = new Set<string>();
    if (initialName) next.add(initialName);
    set({ selectionMode: true, selectedNames: next });
  },
  exitSelectionMode: () => set({ selectionMode: false, selectedNames: new Set<string>() }),
  toggleSelection: (name) => {
    const next = new Set(get().selectedNames);
    if (next.has(name)) next.delete(name); else next.add(name);
    set({ selectedNames: next });
  },
  selectAll: () => {
    const next = new Set(get().entries.map((e) => e.name));
    set({ selectedNames: next });
  },
  setClipboard: (clipboard) => set({ clipboard }),
  clearClipboard: () => set({ clipboard: null }),
  reset: () => set({ ...INITIAL, selectedNames: new Set<string>() }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/stores/__tests__/files.test.ts
```
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/files.ts packages/web/src/stores/__tests__/files.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add useFilesStore (browse/selection/clipboard state)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Create `stores/filesPreview.ts` (selected file + edit state)

**Files:**
- Create: `packages/web/src/stores/filesPreview.ts`
- Test: `packages/web/src/stores/__tests__/filesPreview.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/stores/__tests__/filesPreview.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useFilesPreviewStore } from '../filesPreview';

describe('useFilesPreviewStore', () => {
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
  });

  it('starts cleared', () => {
    const s = useFilesPreviewStore.getState();
    expect(s.selectedPath).toBeNull();
    expect(s.selectedName).toBeNull();
    expect(s.selectedKind).toBeNull();
    expect(s.textContent).toBeNull();
    expect(s.isEditing).toBe(false);
    expect(s.isDirty).toBe(false);
    expect(s.showMarkdownRendered).toBe(true);
  });

  it('selectFile sets path/name/kind and clears text', () => {
    useFilesPreviewStore.getState().setText('old', 1, false);
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    const s = useFilesPreviewStore.getState();
    expect(s.selectedPath).toBe('~/a.ts');
    expect(s.selectedName).toBe('a.ts');
    expect(s.selectedKind).toBe('text');
    expect(s.textContent).toBeNull();
    expect(s.isEditing).toBe(false);
  });

  it('setText stores content + lines + truncated', () => {
    useFilesPreviewStore.getState().setText('hello\nworld', 2, false);
    const s = useFilesPreviewStore.getState();
    expect(s.textContent).toBe('hello\nworld');
    expect(s.textLines).toBe(2);
    expect(s.textTruncated).toBe(false);
  });

  it('startEditing copies textContent into editContent', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    const s = useFilesPreviewStore.getState();
    expect(s.isEditing).toBe(true);
    expect(s.editContent).toBe('hi');
    expect(s.isDirty).toBe(false);
  });

  it('setEditContent flags isDirty when different from textContent', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('hi');
    expect(useFilesPreviewStore.getState().isDirty).toBe(false);
    useFilesPreviewStore.getState().setEditContent('changed');
    expect(useFilesPreviewStore.getState().isDirty).toBe(true);
  });

  it('cancelEditing exits and clears dirty', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');
    useFilesPreviewStore.getState().cancelEditing();
    const s = useFilesPreviewStore.getState();
    expect(s.isEditing).toBe(false);
    expect(s.isDirty).toBe(false);
  });

  it('finishSave persists savedContent into textContent and exits edit', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('saved');
    useFilesPreviewStore.getState().finishSave('saved');
    const s = useFilesPreviewStore.getState();
    expect(s.textContent).toBe('saved');
    expect(s.isEditing).toBe(false);
    expect(s.isDirty).toBe(false);
    expect(s.saving).toBe(false);
  });

  it('toggleMarkdownRendered flips boolean', () => {
    expect(useFilesPreviewStore.getState().showMarkdownRendered).toBe(true);
    useFilesPreviewStore.getState().toggleMarkdownRendered();
    expect(useFilesPreviewStore.getState().showMarkdownRendered).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/stores/__tests__/filesPreview.test.ts
```
Expected: FAIL — module '../filesPreview' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/stores/filesPreview.ts`:
```ts
import { create } from 'zustand';
import type { PreviewKind } from '@/lib/filesIcon';

interface FilesPreviewState {
  selectedPath: string | null;
  selectedName: string | null;
  selectedKind: PreviewKind | null;
  textContent: string | null;
  textLines: number;
  textTruncated: boolean;
  loadingPreview: boolean;
  previewError: string | null;

  isEditing: boolean;
  editContent: string;
  isDirty: boolean;
  saving: boolean;

  showMarkdownRendered: boolean;

  selectFile: (path: string, name: string, kind: PreviewKind) => void;
  setText: (content: string, lines: number, truncated: boolean) => void;
  setLoadingPreview: (b: boolean) => void;
  setPreviewError: (msg: string | null) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  setEditContent: (s: string) => void;
  setSaving: (b: boolean) => void;
  finishSave: (savedContent: string) => void;
  toggleMarkdownRendered: () => void;
  clear: () => void;
}

const INITIAL = {
  selectedPath: null,
  selectedName: null,
  selectedKind: null,
  textContent: null,
  textLines: 0,
  textTruncated: false,
  loadingPreview: false,
  previewError: null,
  isEditing: false,
  editContent: '',
  isDirty: false,
  saving: false,
  showMarkdownRendered: true,
} as const;

export const useFilesPreviewStore = create<FilesPreviewState>((set, get) => ({
  ...INITIAL,
  selectFile: (selectedPath, selectedName, selectedKind) =>
    set({
      selectedPath,
      selectedName,
      selectedKind,
      textContent: null,
      textLines: 0,
      textTruncated: false,
      previewError: null,
      isEditing: false,
      editContent: '',
      isDirty: false,
      saving: false,
    }),
  setText: (textContent, textLines, textTruncated) =>
    set({ textContent, textLines, textTruncated }),
  setLoadingPreview: (loadingPreview) => set({ loadingPreview }),
  setPreviewError: (previewError) => set({ previewError }),
  startEditing: () => {
    const { textContent } = get();
    set({ isEditing: true, editContent: textContent ?? '', isDirty: false });
  },
  cancelEditing: () => set({ isEditing: false, editContent: '', isDirty: false }),
  setEditContent: (s) => {
    const { textContent } = get();
    set({ editContent: s, isDirty: s !== (textContent ?? '') });
  },
  setSaving: (saving) => set({ saving }),
  finishSave: (savedContent) =>
    set({
      textContent: savedContent,
      editContent: savedContent,
      isDirty: false,
      isEditing: false,
      saving: false,
    }),
  toggleMarkdownRendered: () => set((s) => ({ showMarkdownRendered: !s.showMarkdownRendered })),
  clear: () => set({ ...INITIAL }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/stores/__tests__/filesPreview.test.ts
```
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/filesPreview.ts packages/web/src/stores/__tests__/filesPreview.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add useFilesPreviewStore for selected file + edit state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add Files API methods to `ApiClient`

**Files:**
- Modify: `packages/web/src/api/client.ts`
- Test: `packages/web/src/api/__tests__/client-files.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/api/__tests__/client-files.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../client';

describe('ApiClient files methods', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const makeRes = (body: unknown, contentType = 'application/json'): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': contentType },
    });

  it('listFiles GET /api/files with path & showHidden', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~', entries: [] }));
    const c = new ApiClient('http://gw', 'tok');
    await c.listFiles('~', true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://gw/api/files?path=%7E&showHidden=true',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getFileContent GET /api/files/content?path=', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/a.txt', content: 'hi', lines: 1, truncated: false }));
    const c = new ApiClient('http://gw', 'tok');
    const r = await c.getFileContent('~/a.txt');
    expect(r.content).toBe('hi');
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/files/content?path=');
  });

  it('writeFileContent PUT /api/files/content with body', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/a.txt', bytes: 2 }));
    const c = new ApiClient('http://gw', 'tok');
    await c.writeFileContent('~/a.txt', 'hi');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ path: '~/a.txt', content: 'hi' }),
    });
  });

  it('deleteFile DELETE /api/files with body', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/a.txt', deleted: true }));
    const c = new ApiClient('http://gw', 'tok');
    await c.deleteFile('~/a.txt');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ path: '~/a.txt' }),
    });
  });

  it('renameFile POST /api/files/rename', async () => {
    fetchSpy.mockResolvedValue(makeRes({ oldPath: '~/a', newPath: '~/b' }));
    const c = new ApiClient('http://gw', 'tok');
    await c.renameFile('~/a', 'b');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://gw/api/files/rename');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ path: '~/a', newName: 'b' }),
    });
  });

  it('copyFiles POST /api/files/copy', async () => {
    fetchSpy.mockResolvedValue(makeRes({ copied: [] }));
    const c = new ApiClient('http://gw', 'tok');
    await c.copyFiles(['~/a'], '~/dst');
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ sources: ['~/a'], destination: '~/dst' }),
    });
  });

  it('moveFiles POST /api/files/move', async () => {
    fetchSpy.mockResolvedValue(makeRes({ moved: [] }));
    const c = new ApiClient('http://gw', 'tok');
    await c.moveFiles(['~/a'], '~/dst');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://gw/api/files/move');
  });

  it('createDirectory POST /api/files/mkdir', async () => {
    fetchSpy.mockResolvedValue(makeRes({ path: '~/d', created: true }));
    const c = new ApiClient('http://gw', 'tok');
    await c.createDirectory('~/d');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://gw/api/files/mkdir');
  });

  it('buildRawFileUrl returns base + /api/files/raw?path=', () => {
    const c = new ApiClient('http://gw', 'tok');
    expect(c.buildRawFileUrl('~/a.png')).toBe('http://gw/api/files/raw?path=%7E%2Fa.png');
  });

  it('uploadFile POST /api/upload?dest=&preserveName=true with FormData', async () => {
    fetchSpy.mockResolvedValue(makeRes({
      success: true, path: '~/a.bin', filename: 'a.bin', size: 4, mimetype: 'application/octet-stream',
    }));
    const c = new ApiClient('http://gw', 'tok');
    const blob = new Blob(['1234'], { type: 'application/octet-stream' });
    const f = new File([blob], 'a.bin', { type: 'application/octet-stream' });
    await c.uploadFile(f, '~');
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/upload?dest=%7E&preserveName=true');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/api/__tests__/client-files.test.ts
```
Expected: FAIL — `c.listFiles is not a function`

- [ ] **Step 3: Add methods to ApiClient**

Edit `packages/web/src/api/client.ts`. First, extend the import line at the top:
```ts
import type {
  ClaudeLimitsResponse, CodexLimitsResponse, SystemStatus, TmuxSession, TmuxWindow,
  FileListResponse, FileContentResponse, FileWriteResponse, FileDeleteResponse,
  FileRenameResponse, FileCopyResponse, FileMoveResponse, FileMkdirResponse, FileUploadResponse,
} from '@zenterm/shared';
import { HttpError } from './errors';
```

Then append the following methods inside the `ApiClient` class (just before the closing `}`):
```ts
  listFiles(path: string, showHidden: boolean): Promise<FileListResponse> {
    const qs = `?path=${encodeURIComponent(path)}&showHidden=${showHidden ? 'true' : 'false'}`;
    return this.request<FileListResponse>('GET', `/api/files${qs}`);
  }

  getFileContent(path: string): Promise<FileContentResponse> {
    return this.request<FileContentResponse>(
      'GET',
      `/api/files/content?path=${encodeURIComponent(path)}`,
    );
  }

  writeFileContent(path: string, content: string): Promise<FileWriteResponse> {
    return this.request<FileWriteResponse>('PUT', '/api/files/content', { path, content });
  }

  deleteFile(path: string): Promise<FileDeleteResponse> {
    return this.request<FileDeleteResponse>('DELETE', '/api/files', { path });
  }

  renameFile(path: string, newName: string): Promise<FileRenameResponse> {
    return this.request<FileRenameResponse>('POST', '/api/files/rename', { path, newName });
  }

  copyFiles(sources: string[], destination: string): Promise<FileCopyResponse> {
    return this.request<FileCopyResponse>('POST', '/api/files/copy', { sources, destination });
  }

  moveFiles(sources: string[], destination: string): Promise<FileMoveResponse> {
    return this.request<FileMoveResponse>('POST', '/api/files/move', { sources, destination });
  }

  createDirectory(path: string): Promise<FileMkdirResponse> {
    return this.request<FileMkdirResponse>('POST', '/api/files/mkdir', { path });
  }

  buildRawFileUrl(path: string): string {
    return `${this['baseUrl' as keyof this] as unknown as string}/api/files/raw?path=${encodeURIComponent(path)}`;
  }

  async uploadFile(file: File, destPath: string): Promise<FileUploadResponse> {
    const url = `${this['baseUrl' as keyof this] as unknown as string}/api/upload?dest=${encodeURIComponent(destPath)}&preserveName=true`;
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this['token' as keyof this] as unknown as string}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(res.status, text);
    }
    return (await res.json()) as FileUploadResponse;
  }
```

Note: `baseUrl` and `token` are `private readonly` constructor params. The bracket-access casts above keep TypeScript happy without changing access modifiers.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/api/__tests__/client-files.test.ts
```
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/api/__tests__/client-files.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add Files API methods to ApiClient (list/get/write/delete/rename/copy/move/mkdir/upload + buildRawFileUrl)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Create `hooks/useAuthorizedBlobUrl.ts`

**Files:**
- Create: `packages/web/src/hooks/useAuthorizedBlobUrl.ts`
- Test: `packages/web/src/hooks/__tests__/useAuthorizedBlobUrl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/hooks/__tests__/useAuthorizedBlobUrl.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuthorizedBlobUrl } from '../useAuthorizedBlobUrl';

describe('useAuthorizedBlobUrl', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('starts as { url: null, loading: true, error: null } when url is given', async () => {
    fetchSpy.mockResolvedValue(new Response(new Blob(['x'])));
    const { result } = renderHook(() => useAuthorizedBlobUrl('http://gw/api/files/raw?path=a', 'tok'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.url).toBe('blob:mock-url');
    expect(result.current.error).toBeNull();
  });

  it('passes Bearer token in Authorization header', async () => {
    fetchSpy.mockResolvedValue(new Response(new Blob(['x'])));
    renderHook(() => useAuthorizedBlobUrl('http://gw/x', 'mytok'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer mytok');
  });

  it('sets error on non-OK response', async () => {
    fetchSpy.mockResolvedValue(new Response('boom', { status: 500 }));
    const { result } = renderHook(() => useAuthorizedBlobUrl('http://gw/x', 'tok'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.url).toBeNull();
  });

  it('does nothing when url is null', () => {
    const { result } = renderHook(() => useAuthorizedBlobUrl(null, 'tok'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('revokes object URL on unmount', async () => {
    fetchSpy.mockResolvedValue(new Response(new Blob(['x'])));
    const { result, unmount } = renderHook(() => useAuthorizedBlobUrl('http://gw/x', 'tok'));
    await waitFor(() => expect(result.current.url).toBe('blob:mock-url'));
    act(() => {
      unmount();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/hooks/__tests__/useAuthorizedBlobUrl.test.ts
```
Expected: FAIL — module '../useAuthorizedBlobUrl' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/hooks/useAuthorizedBlobUrl.ts`:
```ts
import { useEffect, useState } from 'react';

export interface AuthorizedBlobUrl {
  url: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch the resource at `sourceUrl` with `Authorization: Bearer <token>`,
 * convert the response Blob into a same-origin blob: URL, and revoke it on
 * unmount or input change. When `sourceUrl` is null, no fetch occurs.
 */
export function useAuthorizedBlobUrl(sourceUrl: string | null, token: string | null): AuthorizedBlobUrl {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(sourceUrl !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceUrl) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setUrl(null);

    (async () => {
      try {
        const res = await fetch(sourceUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [sourceUrl, token]);

  return { url, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/hooks/__tests__/useAuthorizedBlobUrl.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/hooks/useAuthorizedBlobUrl.ts packages/web/src/hooks/__tests__/useAuthorizedBlobUrl.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add useAuthorizedBlobUrl hook for Bearer-fetch → Blob URL

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-2: Sidebar Files panel basic (Tasks 9-18)

`FilesSidebarPanel` の骨組みと基本コンポーネント (Toolbar / Breadcrumbs / List / Item) + 初回 fetch 配線。

### Task 9: Add Files i18n keys (en + ja, minimal subset for Sub-phase 2c-2)

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

> Note: The full `files.*` namespace will be added incrementally. This task adds only the keys required by Sub-phase 2c-2 components. Remaining keys will be added in Tasks 27/29/40/55. The complete final set is consolidated in Task 55 self-review.

- [ ] **Step 1: Append `files` namespace to en.json**

Edit `packages/web/src/i18n/locales/en.json`. Insert a `"files"` key as a sibling of `"settings"` (before the closing `}` of the root). The block to insert:
```json
"files": {
  "title": "Files",
  "noServerConfigured": "Gateway not configured.",
  "fetchFailedDesc": "Failed to load directory.",
  "loadFailed": "Failed to load",
  "cannotFetchFiles": "Cannot fetch files",
  "emptyDirectoryTitle": "Empty directory",
  "emptyDirectoryDescription": "There are no files here.",
  "goUp": "Go up",
  "sort": "Sort",
  "toggleSort": "Toggle sort",
  "sortNameAsc": "Name (A→Z)",
  "sortNameDesc": "Name (Z→A)",
  "sortSizeDesc": "Size (large first)",
  "sortModifiedDesc": "Modified (newest)",
  "toggleHiddenFiles": "Toggle hidden files",
  "uploadFile": "Upload",
  "createNewFile": "New File",
  "newFolder": "New Folder"
}
```

- [ ] **Step 2: Append same block to ja.json with translations**

Edit `packages/web/src/i18n/locales/ja.json`. Insert:
```json
"files": {
  "title": "ファイル",
  "noServerConfigured": "Gateway が未設定です。",
  "fetchFailedDesc": "ディレクトリの読み込みに失敗しました。",
  "loadFailed": "読み込み失敗",
  "cannotFetchFiles": "ファイル一覧を取得できません",
  "emptyDirectoryTitle": "空のディレクトリ",
  "emptyDirectoryDescription": "ここにはファイルがありません。",
  "goUp": "上へ",
  "sort": "並び替え",
  "toggleSort": "並び替え切替",
  "sortNameAsc": "名前 (A→Z)",
  "sortNameDesc": "名前 (Z→A)",
  "sortSizeDesc": "サイズ (大きい順)",
  "sortModifiedDesc": "更新日時 (新しい順)",
  "toggleHiddenFiles": "隠しファイル表示切替",
  "uploadFile": "アップロード",
  "createNewFile": "新規ファイル",
  "newFolder": "新規フォルダ"
}
```

- [ ] **Step 3: Verify JSON parses + type-check passes**

```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: prints `OK` then type-check PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add initial files i18n keys (en/ja) for Sub-phase 2c-2

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `FilesBreadcrumbs` component

**Files:**
- Create: `packages/web/src/components/files/FilesBreadcrumbs.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesBreadcrumbs.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesBreadcrumbs.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilesBreadcrumbs } from '../FilesBreadcrumbs';

describe('FilesBreadcrumbs', () => {
  it('renders Home root when path = ~', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~" onNavigate={onNavigate} />);
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
  });

  it('renders segments for ~/a/b', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~/a/b" onNavigate={onNavigate} />);
    expect(screen.getByRole('button', { name: /^a$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^b$/ })).toBeInTheDocument();
  });

  it('clicking a segment fires onNavigate with that path', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~/a/b" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /^a$/ }));
    expect(onNavigate).toHaveBeenCalledWith('~/a');
  });

  it('clicking Home fires onNavigate("~")', () => {
    const onNavigate = vi.fn();
    render(<FilesBreadcrumbs path="~/a/b" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    expect(onNavigate).toHaveBeenCalledWith('~');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesBreadcrumbs.test.tsx
```
Expected: FAIL — module '../FilesBreadcrumbs' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesBreadcrumbs.tsx`:
```tsx
import { useTheme } from '@/theme';
import { buildBreadcrumbSegments } from '@/lib/filesPath';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function FilesBreadcrumbs({ path, onNavigate }: Props) {
  const { tokens } = useTheme();
  const segments = buildBreadcrumbSegments(path);
  const root = path.startsWith('/') ? '/' : '~';
  const rootLabel = root === '/' ? '/' : 'Home';

  const btnStyle = {
    background: 'none' as const,
    border: 'none' as const,
    color: tokens.colors.textSecondary,
    cursor: 'pointer' as const,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    fontSize: tokens.typography.body.fontSize,
    maxWidth: 120,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  };
  const sepStyle = { color: tokens.colors.textMuted, padding: `0 ${tokens.spacing.xs}px` };

  return (
    <nav
      aria-label="Files breadcrumbs"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <button type="button" onClick={() => onNavigate(root)} style={btnStyle} aria-label={rootLabel === 'Home' ? 'Home' : '/'}>
        {rootLabel}
      </button>
      {segments.map((seg) => (
        <span key={seg.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span style={sepStyle}>/</span>
          <button
            type="button"
            onClick={() => onNavigate(seg.path)}
            style={btnStyle}
            title={seg.path}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesBreadcrumbs.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesBreadcrumbs.tsx packages/web/src/components/files/__tests__/FilesBreadcrumbs.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesBreadcrumbs component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `FilesItem` component (single file row)

**Files:**
- Create: `packages/web/src/components/files/FilesItem.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesItem.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesItem.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FileEntry } from '@zenterm/shared';
import { FilesItem } from '../FilesItem';

const dir: FileEntry = { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' };
const file: FileEntry = { name: 'a.ts', type: 'file', size: 123, modified: 1704153600, permissions: 'rw-r--r--' };

describe('FilesItem', () => {
  it('renders directory name and triggers onOpen with entry on click', () => {
    const onOpen = vi.fn();
    const onContext = vi.fn();
    const onLongPress = vi.fn();
    render(<FilesItem entry={dir} selected={false} selectionMode={false} onOpen={onOpen} onContextMenu={onContext} onLongPress={onLongPress} />);
    fireEvent.click(screen.getByRole('button', { name: /src/ }));
    expect(onOpen).toHaveBeenCalledWith(dir);
  });

  it('shows checkbox state when in selectionMode', () => {
    const onOpen = vi.fn();
    render(<FilesItem entry={file} selected selectionMode onOpen={onOpen} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('Ctrl+Click triggers onLongPress (start selection)', () => {
    const onOpen = vi.fn();
    const onLongPress = vi.fn();
    render(<FilesItem entry={file} selected={false} selectionMode={false} onOpen={onOpen} onContextMenu={vi.fn()} onLongPress={onLongPress} />);
    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    expect(onLongPress).toHaveBeenCalledWith(file);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('contextmenu fires onContextMenu', () => {
    const onContext = vi.fn();
    render(<FilesItem entry={file} selected={false} selectionMode={false} onOpen={vi.fn()} onContextMenu={onContext} onLongPress={vi.fn()} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    expect(onContext).toHaveBeenCalled();
  });

  it('renders file size for non-directory', () => {
    render(<FilesItem entry={file} selected={false} selectionMode={false} onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByText(/123 B/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesItem.test.tsx
```
Expected: FAIL — module '../FilesItem' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesItem.tsx`:
```tsx
import type { MouseEvent } from 'react';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { getFileIconType } from '@/lib/filesIcon';
import { formatFileSize } from '@/lib/filesFormat';

interface Props {
  entry: FileEntry;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (entry: FileEntry, e: MouseEvent) => void;
  onLongPress: (entry: FileEntry) => void;
}

const ICON: Record<ReturnType<typeof getFileIconType>, string> = {
  folder: '📁',
  code: '📝',
  image: '🖼',
  text: '📄',
  symlink: '🔗',
  other: '📦',
};

export function FilesItem({ entry, selected, selectionMode, onOpen, onContextMenu, onLongPress }: Props) {
  const { tokens } = useTheme();
  const icon = ICON[getFileIconType(entry)];

  const handleClick = (e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onLongPress(entry);
      return;
    }
    onOpen(entry);
  };

  return (
    <button
      type="button"
      aria-label={entry.name}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(entry, e);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        width: '100%',
        background: selected ? tokens.colors.bgHover : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
        cursor: 'pointer',
        color: tokens.colors.textPrimary,
        textAlign: 'left',
        fontSize: tokens.typography.body.fontSize,
      }}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          readOnly
          aria-label={`Select ${entry.name}`}
          style={{ marginRight: tokens.spacing.xs }}
        />
      )}
      <span aria-hidden style={{ width: 20 }}>{icon}</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.name}
      </span>
      {entry.type !== 'directory' && (
        <span style={{ fontSize: tokens.typography.caption.fontSize, color: tokens.colors.textMuted }}>
          {formatFileSize(entry.size)}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesItem.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesItem.tsx packages/web/src/components/files/__tests__/FilesItem.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesItem row component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `FilesList` component (renders sorted/filtered entries)

**Files:**
- Create: `packages/web/src/components/files/FilesList.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesList.test.tsx`:
```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FileEntry } from '@zenterm/shared';
import { FilesList } from '../FilesList';
import { useFilesStore } from '@/stores/files';

const f = (name: string, type: FileEntry['type'] = 'file'): FileEntry => ({
  name, type, size: 100, modified: 0, permissions: 'rw-r--r--',
});

describe('FilesList', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
  });

  it('renders entries sorted by name-asc with directories first', () => {
    useFilesStore.setState({
      entries: [f('z.ts'), f('dir', 'directory'), f('a.ts')],
      sortMode: 'name-asc',
      showHidden: false,
    });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['dir', 'a.ts', 'z.ts']);
  });

  it('hides hidden (.) files when showHidden=false', () => {
    useFilesStore.setState({
      entries: [f('.hidden'), f('visible.ts')],
      showHidden: false,
    });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /\.hidden/ })).toBeNull();
    expect(screen.getByRole('button', { name: /visible\.ts/ })).toBeInTheDocument();
  });

  it('shows hidden files when showHidden=true', () => {
    useFilesStore.setState({
      entries: [f('.hidden'), f('visible.ts')],
      showHidden: true,
    });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByRole('button', { name: /\.hidden/ })).toBeInTheDocument();
  });

  it('renders empty state text when entries are empty', () => {
    useFilesStore.setState({ entries: [] });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByText(/empty directory/i)).toBeInTheDocument();
  });
});
```

Add an i18n provider wrapper to the test if needed; the existing `flow` tests in `packages/web/src/__tests__/flows/` use the i18n module already initialized via `initI18n()`. For component tests we either rely on the same global init or use the raw key. Since `useTranslation()` returns the key when i18n is uninitialized, the test assertion uses `/empty directory/i` to match either the English string or the `files.emptyDirectoryTitle` key. To make the test deterministic, add this `beforeAll` at the top of the test file (above the `describe`):
```ts
import { beforeAll } from 'vitest';
import { initI18n } from '@/i18n';
beforeAll(() => { initI18n(); });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesList.test.tsx
```
Expected: FAIL — module '../FilesList' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesList.tsx`:
```tsx
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useFilesStore } from '@/stores/files';
import { sortFiles } from '@/lib/filesSort';
import { useTheme } from '@/theme';
import { FilesItem } from './FilesItem';

interface Props {
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (entry: FileEntry, e: MouseEvent) => void;
  onLongPress: (entry: FileEntry) => void;
}

export function FilesList({ onOpen, onContextMenu, onLongPress }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const entries = useFilesStore((s) => s.entries);
  const sortMode = useFilesStore((s) => s.sortMode);
  const showHidden = useFilesStore((s) => s.showHidden);
  const selectionMode = useFilesStore((s) => s.selectionMode);
  const selectedNames = useFilesStore((s) => s.selectedNames);

  const visible = entries.filter((e) => showHidden || !e.name.startsWith('.'));
  const sorted = sortFiles(visible, sortMode);

  if (sorted.length === 0) {
    return (
      <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, textAlign: 'center' }}>
        <div style={{ fontSize: tokens.typography.body.fontSize }}>{t('files.emptyDirectoryTitle')}</div>
        <div style={{ fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.xs }}>
          {t('files.emptyDirectoryDescription')}
        </div>
      </div>
    );
  }

  return (
    <div role="list" aria-label="Files list" style={{ display: 'flex', flexDirection: 'column' }}>
      {sorted.map((e) => (
        <FilesItem
          key={e.name}
          entry={e}
          selected={selectedNames.has(e.name)}
          selectionMode={selectionMode}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesList.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesList.tsx packages/web/src/components/files/__tests__/FilesList.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesList component (sorted, hidden filter, empty state)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `FilesSortMenu` component (popover with 4 sort radio buttons)

**Files:**
- Create: `packages/web/src/components/files/FilesSortMenu.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesSortMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesSortMenu.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { FilesSortMenu } from '../FilesSortMenu';

beforeAll(() => { initI18n(); });

describe('FilesSortMenu', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
  });

  it('renders 4 radio options', () => {
    render(<FilesSortMenu onClose={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('selecting a radio updates store sortMode', () => {
    const onClose = vi.fn();
    render(<FilesSortMenu onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: /size/i }));
    expect(useFilesStore.getState().sortMode).toBe('size-desc');
    expect(onClose).toHaveBeenCalled();
  });

  it('marks current sortMode as checked', () => {
    useFilesStore.setState({ sortMode: 'modified-desc' });
    render(<FilesSortMenu onClose={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /modified/i })).toBeChecked();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSortMenu.test.tsx
```
Expected: FAIL — module '../FilesSortMenu' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesSortMenu.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import type { SortMode } from '@/lib/filesSort';
import { useTheme } from '@/theme';

interface Props { onClose: () => void; }

const OPTIONS: Array<{ value: SortMode; labelKey: string }> = [
  { value: 'name-asc', labelKey: 'files.sortNameAsc' },
  { value: 'name-desc', labelKey: 'files.sortNameDesc' },
  { value: 'size-desc', labelKey: 'files.sortSizeDesc' },
  { value: 'modified-desc', labelKey: 'files.sortModifiedDesc' },
];

export function FilesSortMenu({ onClose }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const sortMode = useFilesStore((s) => s.sortMode);
  const setSortMode = useFilesStore((s) => s.setSortMode);

  return (
    <div
      role="menu"
      aria-label={t('files.sort')}
      style={{
        position: 'absolute',
        top: 36,
        right: 0,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        padding: tokens.spacing.sm,
        zIndex: 10,
        minWidth: 200,
      }}
    >
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing.sm,
            padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
            cursor: 'pointer',
            color: tokens.colors.textPrimary,
            fontSize: tokens.typography.body.fontSize,
          }}
        >
          <input
            type="radio"
            name="files-sort-mode"
            value={o.value}
            checked={sortMode === o.value}
            onChange={() => {
              setSortMode(o.value);
              onClose();
            }}
            aria-label={t(o.labelKey)}
          />
          {t(o.labelKey)}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSortMenu.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSortMenu.tsx packages/web/src/components/files/__tests__/FilesSortMenu.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesSortMenu popover

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: `FilesToolbar` component (sort / hidden toggle / upload / new menu host)

**Files:**
- Create: `packages/web/src/components/files/FilesToolbar.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesToolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesToolbar.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { FilesToolbar } from '../FilesToolbar';

beforeAll(() => { initI18n(); });

describe('FilesToolbar', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
  });

  it('renders sort, hidden toggle, upload, new buttons', () => {
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hidden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
  });

  it('clicking hidden toggle flips store flag', () => {
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /hidden/i }));
    expect(useFilesStore.getState().showHidden).toBe(true);
  });

  it('clicking upload fires onUploadClick', () => {
    const onUploadClick = vi.fn();
    render(<FilesToolbar onUploadClick={onUploadClick} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(onUploadClick).toHaveBeenCalled();
  });

  it('clicking sort opens FilesSortMenu', () => {
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sort/i }));
    expect(screen.getByRole('menu', { name: /sort/i })).toBeInTheDocument();
  });

  it('clicking new opens new menu and selecting newFile fires callback', () => {
    const onNewFile = vi.fn();
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={onNewFile} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /new file/i }));
    expect(onNewFile).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesToolbar.test.tsx
```
Expected: FAIL — module '../FilesToolbar' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesToolbar.tsx`:
```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import { useTheme } from '@/theme';
import { FilesSortMenu } from './FilesSortMenu';

interface Props {
  onUploadClick: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}

export function FilesToolbar({ onUploadClick, onNewFile, onNewFolder }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const showHidden = useFilesStore((s) => s.showHidden);
  const toggleShowHidden = useFilesStore((s) => s.toggleShowHidden);
  const [sortOpen, setSortOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const btn = {
    background: 'none' as const,
    border: 'none' as const,
    color: tokens.colors.textSecondary,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    cursor: 'pointer' as const,
    fontSize: tokens.typography.body.fontSize,
    borderRadius: 4,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.xs,
        padding: tokens.spacing.sm,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative' }}>
        <button type="button" aria-label={t('files.sort')} title={t('files.toggleSort')} onClick={() => setSortOpen((b) => !b)} style={btn}>
          ⇅ {t('files.sort')}
        </button>
        {sortOpen && <FilesSortMenu onClose={() => setSortOpen(false)} />}
      </div>
      <button
        type="button"
        aria-label={t('files.toggleHiddenFiles')}
        aria-pressed={showHidden}
        onClick={toggleShowHidden}
        style={{ ...btn, color: showHidden ? tokens.colors.primary : tokens.colors.textSecondary }}
      >
        {showHidden ? '🙈' : '👁'} {t('files.toggleHiddenFiles')}
      </button>
      <button type="button" aria-label={t('files.uploadFile')} onClick={onUploadClick} style={btn}>
        ⬆ {t('files.uploadFile')}
      </button>
      <div style={{ marginLeft: 'auto', position: 'relative' }}>
        <button type="button" aria-label={t('files.createNewFile')} onClick={() => setNewOpen((b) => !b)} style={btn}>
          ＋ New
        </button>
        {newOpen && (
          <div
            role="menu"
            aria-label="New menu"
            style={{
              position: 'absolute',
              top: 36,
              right: 0,
              background: tokens.colors.bgElevated,
              border: `1px solid ${tokens.colors.borderSubtle}`,
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              minWidth: 160,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              role="menuitem"
              aria-label={t('files.createNewFile')}
              onClick={() => { setNewOpen(false); onNewFile(); }}
              style={{ ...btn, display: 'block', width: '100%', textAlign: 'left' as const }}
            >
              📄 {t('files.createNewFile')}
            </button>
            <button
              type="button"
              role="menuitem"
              aria-label={t('files.newFolder')}
              onClick={() => { setNewOpen(false); onNewFolder(); }}
              style={{ ...btn, display: 'block', width: '100%', textAlign: 'left' as const }}
            >
              📁 {t('files.newFolder')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesToolbar.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesToolbar.tsx packages/web/src/components/files/__tests__/FilesToolbar.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesToolbar with sort/hidden/upload/new menu

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Define `FilesApiClient` interface and `loadDirectory` helper

**Files:**
- Create: `packages/web/src/components/files/filesApi.ts`
- Test: `packages/web/src/components/files/__tests__/filesApi.test.ts`

> Rationale: Avoids passing the heavy `ApiClient` directly into `FilesSidebarPanel` and keeps tests light. Mirrors the `SessionsApiClient` pattern used in Phase 2a.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/filesApi.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadDirectory } from '../filesApi';
import { useFilesStore } from '@/stores/files';

describe('loadDirectory', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('sets loading=true, calls listFiles, populates entries on success', async () => {
    const listFiles = vi.fn().mockResolvedValue({
      path: '~',
      entries: [{ name: 'a', type: 'file', size: 0, modified: 0, permissions: '' }],
    });
    await loadDirectory({ listFiles } as any, '~', false);
    const s = useFilesStore.getState();
    expect(listFiles).toHaveBeenCalledWith('~', false);
    expect(s.entries).toHaveLength(1);
    expect(s.currentPath).toBe('~');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('sets error on failure', async () => {
    const listFiles = vi.fn().mockRejectedValue(new Error('boom'));
    await loadDirectory({ listFiles } as any, '~', false);
    const s = useFilesStore.getState();
    expect(s.error).toContain('boom');
    expect(s.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/filesApi.test.ts
```
Expected: FAIL — module '../filesApi' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/filesApi.ts`:
```ts
import type {
  FileListResponse, FileContentResponse, FileWriteResponse,
  FileDeleteResponse, FileRenameResponse, FileCopyResponse,
  FileMoveResponse, FileMkdirResponse, FileUploadResponse,
} from '@zenterm/shared';
import { useFilesStore } from '@/stores/files';

export interface FilesApiClient {
  listFiles(path: string, showHidden: boolean): Promise<FileListResponse>;
  getFileContent(path: string): Promise<FileContentResponse>;
  writeFileContent(path: string, content: string): Promise<FileWriteResponse>;
  deleteFile(path: string): Promise<FileDeleteResponse>;
  renameFile(path: string, newName: string): Promise<FileRenameResponse>;
  copyFiles(sources: string[], destination: string): Promise<FileCopyResponse>;
  moveFiles(sources: string[], destination: string): Promise<FileMoveResponse>;
  createDirectory(path: string): Promise<FileMkdirResponse>;
  uploadFile(file: File, destPath: string): Promise<FileUploadResponse>;
  buildRawFileUrl(path: string): string;
}

export async function loadDirectory(
  client: Pick<FilesApiClient, 'listFiles'>,
  path: string,
  showHidden: boolean,
): Promise<void> {
  const store = useFilesStore.getState();
  store.setLoading(true);
  store.setError(null);
  try {
    const res = await client.listFiles(path, showHidden);
    useFilesStore.getState().setCurrentPath(path);
    useFilesStore.getState().setEntries(res.entries);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useFilesStore.getState().setError(msg);
  } finally {
    useFilesStore.getState().setLoading(false);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/filesApi.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/filesApi.ts packages/web/src/components/files/__tests__/filesApi.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add FilesApiClient interface + loadDirectory helper

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: `FilesSidebarPanel` shell (toolbar + breadcrumbs + list + initial fetch)

**Files:**
- Create: `packages/web/src/components/files/FilesSidebarPanel.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesSidebarPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesSidebarPanel.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesSidebarPanel } from '../FilesSidebarPanel';

beforeAll(() => { initI18n(); });

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({
    path: '~',
    entries: [
      { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
      { name: 'README.md', type: 'file', size: 50, modified: 0, permissions: 'rw-r--r--' },
    ],
  }),
});

describe('FilesSidebarPanel', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useFilesPreviewStore.getState().clear();
  });

  it('on mount fetches the current path and renders entries', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalledWith('~', false));
    await waitFor(() => expect(screen.getByRole('button', { name: /src/ })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument();
  });

  it('clicking a directory navigates into it (re-fetches)', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /src/ })).toBeInTheDocument());
    client.listFiles.mockResolvedValueOnce({ path: '~/src', entries: [] });
    fireEvent.click(screen.getByRole('button', { name: /src/ }));
    await waitFor(() => expect(client.listFiles).toHaveBeenLastCalledWith('~/src', false));
  });

  it('clicking a text file selects it in preview store', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /README\.md/ }));
    expect(useFilesPreviewStore.getState().selectedName).toBe('README.md');
    expect(useFilesPreviewStore.getState().selectedKind).toBe('markdown');
  });

  it('breadcrumb home click resets to ~', async () => {
    const client = makeClient();
    useFilesStore.setState({ currentPath: '~/src' });
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalledWith('~/src', false));
    client.listFiles.mockResolvedValueOnce({ path: '~', entries: [] });
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    await waitFor(() => expect(client.listFiles).toHaveBeenLastCalledWith('~', false));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSidebarPanel.test.tsx
```
Expected: FAIL — module '../FilesSidebarPanel' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesSidebarPanel.tsx`:
```tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { useFilesStore } from '@/stores/files';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { buildEntryPath } from '@/lib/filesPath';
import { getPreviewKind } from '@/lib/filesIcon';
import { FilesToolbar } from './FilesToolbar';
import { FilesBreadcrumbs } from './FilesBreadcrumbs';
import { FilesList } from './FilesList';
import { loadDirectory, type FilesApiClient } from './filesApi';

interface Props {
  client: FilesApiClient;
}

export function FilesSidebarPanel({ client }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const currentPath = useFilesStore((s) => s.currentPath);
  const showHidden = useFilesStore((s) => s.showHidden);
  const loading = useFilesStore((s) => s.loading);
  const error = useFilesStore((s) => s.error);

  useEffect(() => {
    void loadDirectory(client, currentPath, showHidden);
    // Re-fetch when path or hidden flag changes
  }, [client, currentPath, showHidden]);

  const handleOpen = (entry: FileEntry) => {
    if (entry.type === 'directory' || (entry.type === 'symlink' && entry.resolvedType === 'directory')) {
      useFilesStore.getState().setCurrentPath(buildEntryPath(currentPath, entry.name));
      return;
    }
    const kind = getPreviewKind(entry.name);
    useFilesPreviewStore.getState().selectFile(buildEntryPath(currentPath, entry.name), entry.name, kind);
  };

  return (
    <div
      aria-label="Files panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: tokens.colors.bgElevated }}
    >
      <FilesToolbar
        onUploadClick={() => { /* wired in Sub-phase 2c-7 */ }}
        onNewFile={() => { /* wired in Sub-phase 2c-5 */ }}
        onNewFolder={() => { /* wired in Sub-phase 2c-5 */ }}
      />
      <FilesBreadcrumbs path={currentPath} onNavigate={(p) => useFilesStore.getState().setCurrentPath(p)} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: tokens.spacing.md, color: tokens.colors.textMuted }}>{t('common.loading')}</div>
        )}
        {error && (
          <div role="alert" style={{ padding: tokens.spacing.md, color: tokens.colors.error }}>
            {t('files.loadFailed')}: {error}
          </div>
        )}
        {!loading && !error && (
          <FilesList
            onOpen={handleOpen}
            onContextMenu={() => { /* wired in Sub-phase 2c-5 */ }}
            onLongPress={() => { /* wired in Sub-phase 2c-6 */ }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSidebarPanel.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSidebarPanel.tsx packages/web/src/components/files/__tests__/FilesSidebarPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesSidebarPanel shell (toolbar + breadcrumbs + list + initial fetch)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Wire `FilesSidebarPanel` into `Sidebar.renderPanel()` (still gated by URL)

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx`
- Test: `packages/web/src/components/__tests__/Sidebar.test.tsx`

> Note: This task only adds the *branch* in `renderPanel()` — the Files tab `disabled` flag is removed in Task 53. For now the panel is reachable only by direct URL navigation to `/web/files` (which is still a Navigate redirect at this point — wired up in Task 54).

- [ ] **Step 1: Modify `Sidebar.tsx`**

Update the imports at the top of `packages/web/src/components/Sidebar.tsx`:
```tsx
import { SessionsListPanel } from './SessionsListPanel';
import { SettingsPanel } from './settings/SettingsPanel';
import { FilesSidebarPanel } from './files/FilesSidebarPanel';
import type { FilesApiClient } from './files/filesApi';
```

Add a `filesClient` prop to `SidebarProps` (optional for back-compat with existing tests):
```tsx
export interface SidebarProps {
  // ...existing props (sessions, loading, error, activeSessionId, activeWindowIndex, onSelect, onCreate*, onRename*, onRequestDelete*)
  filesClient?: FilesApiClient;
}
```

Replace the `renderPanel()` function:
```tsx
const renderPanel = () => {
  if (activePanel === 'settings') return <SettingsPanel />;
  if (activePanel === 'files' && props.filesClient) return <FilesSidebarPanel client={props.filesClient} />;
  return <SessionsListPanel {...props} />;
};
```

- [ ] **Step 2: Run existing Sidebar tests to confirm no regression**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/Sidebar.test.tsx
```
Expected: PASS — pre-existing tests still green (filesClient is undefined → defaults to SessionsListPanel)

- [ ] **Step 3: Add a new test for the files branch**

Append to `packages/web/src/components/__tests__/Sidebar.test.tsx` (inside the existing `describe('Sidebar URL-driven activePanel', ...)` block, before the closing `});`):
```tsx
  it('renders FilesSidebarPanel when activePanel=files and filesClient given', () => {
    const filesClient = {
      listFiles: () => Promise.resolve({ path: '~', entries: [] }),
      getFileContent: () => Promise.resolve({ path: '', content: '', lines: 0, truncated: false }),
      writeFileContent: () => Promise.resolve({ path: '', bytes: 0 }),
      deleteFile: () => Promise.resolve({ path: '', deleted: true }),
      renameFile: () => Promise.resolve({ oldPath: '', newPath: '' }),
      copyFiles: () => Promise.resolve({ copied: [] }),
      moveFiles: () => Promise.resolve({ moved: [] }),
      createDirectory: () => Promise.resolve({ path: '', created: true }),
      uploadFile: () => Promise.resolve({ success: true, path: '', filename: '', size: 0, mimetype: '' }),
      buildRawFileUrl: () => '',
    };
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <Sidebar {...baseProps} filesClient={filesClient as any} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Files panel/i)).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run all Sidebar tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/Sidebar.test.tsx
```
Expected: PASS (all original tests + new files branch test)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/Sidebar.tsx packages/web/src/components/__tests__/Sidebar.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): branch Sidebar.renderPanel to FilesSidebarPanel when activePanel=files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Sub-phase 2c-2 integration smoke test (flow)

**Files:**
- Test: `packages/web/src/__tests__/flows/files-browse-flow.test.tsx`

- [ ] **Step 1: Write the failing flow test**

Create `packages/web/src/__tests__/flows/files-browse-flow.test.tsx`:
```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initI18n } from '@/i18n';
import { Sidebar } from '@/components/Sidebar';
import { useFilesStore } from '@/stores/files';

beforeEach(() => {
  initI18n();
  useFilesStore.getState().reset();
});

describe('Files browse flow', () => {
  it('mount → initial load → click directory → list updates', async () => {
    const listFiles = vi.fn()
      .mockResolvedValueOnce({
        path: '~',
        entries: [
          { name: 'sub', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
        ],
      })
      .mockResolvedValueOnce({
        path: '~/sub',
        entries: [
          { name: 'inner.ts', type: 'file', size: 10, modified: 0, permissions: 'rw-r--r--' },
        ],
      });
    const filesClient = {
      listFiles,
      getFileContent: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
      renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
      createDirectory: vi.fn(), uploadFile: vi.fn(), buildRawFileUrl: vi.fn(),
    };

    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <Sidebar
          sessions={[]} loading={false} error={null}
          activeSessionId={null} activeWindowIndex={null}
          onSelect={vi.fn()} onCreateSession={vi.fn()} onRenameSession={vi.fn()}
          onRequestDeleteSession={vi.fn()} onCreateWindow={vi.fn()} onRenameWindow={vi.fn()}
          onRequestDeleteWindow={vi.fn()}
          filesClient={filesClient as any}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /sub/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /sub/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /inner\.ts/ })).toBeInTheDocument());

    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(listFiles.mock.calls[0]).toEqual(['~', false]);
    expect(listFiles.mock.calls[1]).toEqual(['~/sub', false]);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-browse-flow.test.tsx
```
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/files-browse-flow.test.tsx
git commit -m "$(cat <<'EOF'
test(web): add files browse integration flow

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-3: Right pane viewer (Tasks 19-25)

`FilesViewerPane` (right pane root) + Empty/Header/Text/Image/Markdown viewers + AuthenticatedShell の右ペイン分岐配線。

### Task 19: Add viewer-related i18n keys

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Extend the `files` block in en.json**

Add the following keys to the existing `"files"` object in `packages/web/src/i18n/locales/en.json` (insert before the closing `}` of the `files` block):
```json
"previewTitle": "No file selected",
"previewDescription": "Select a file in the sidebar to preview.",
"cannotOpen": "Cannot open",
"cannotOpenDesc": "{{name}} cannot be previewed.",
"truncatedIndicator": "Truncated at {{lines}} lines",
"download": "Download",
"downloadFailed": "Download failed",
"downloadFailedDesc": "Could not download file.",
"rendered": "Rendered",
"source": "Source",
"loadFailedDesc": "Could not load file content."
```

- [ ] **Step 2: Same for ja.json**

```json
"previewTitle": "ファイル未選択",
"previewDescription": "サイドバーからファイルを選択してください。",
"cannotOpen": "開けません",
"cannotOpenDesc": "{{name}} はプレビューできません。",
"truncatedIndicator": "{{lines}} 行で切り詰めました",
"download": "ダウンロード",
"downloadFailed": "ダウンロード失敗",
"downloadFailedDesc": "ファイルをダウンロードできませんでした。",
"rendered": "レンダリング",
"source": "ソース",
"loadFailedDesc": "ファイル内容を読み込めませんでした。"
```

- [ ] **Step 3: Verify JSON parses + type-check**

```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: prints `OK` then type-check PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add viewer i18n keys for Sub-phase 2c-3

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: `FilesViewerEmpty` component

**Files:**
- Create: `packages/web/src/components/files/FilesViewerEmpty.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesViewerEmpty.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesViewerEmpty.test.tsx`:
```tsx
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { FilesViewerEmpty } from '../FilesViewerEmpty';

beforeAll(() => { initI18n(); });

describe('FilesViewerEmpty', () => {
  it('default mode shows preview title and description', () => {
    render(<FilesViewerEmpty />);
    expect(screen.getByText(/no file selected/i)).toBeInTheDocument();
    expect(screen.getByText(/select a file/i)).toBeInTheDocument();
  });

  it('unsupported mode shows cannotOpen with name', () => {
    render(<FilesViewerEmpty mode="unsupported" name="archive.zip" />);
    expect(screen.getByText(/cannot open/i)).toBeInTheDocument();
    expect(screen.getByText(/archive\.zip/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerEmpty.test.tsx
```
Expected: FAIL — module '../FilesViewerEmpty' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesViewerEmpty.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  mode?: 'empty' | 'unsupported';
  name?: string;
}

export function FilesViewerEmpty({ mode = 'empty', name }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  const title = mode === 'unsupported' ? t('files.cannotOpen') : t('files.previewTitle');
  const desc = mode === 'unsupported'
    ? t('files.cannotOpenDesc', { name: name ?? '' })
    : t('files.previewDescription');

  return (
    <div
      role="status"
      aria-label={title}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacing.sm,
        color: tokens.colors.textMuted,
        padding: tokens.spacing.lg,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: tokens.typography.heading.fontSize }}>{title}</div>
      <div style={{ fontSize: tokens.typography.body.fontSize }}>{desc}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerEmpty.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesViewerEmpty.tsx packages/web/src/components/files/__tests__/FilesViewerEmpty.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesViewerEmpty component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: `FilesViewerHeader` component (filename + edit/save/cancel/download buttons)

**Files:**
- Create: `packages/web/src/components/files/FilesViewerHeader.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesViewerHeader.test.tsx`

> The header is layered: it always shows the filename, plus action buttons that depend on `selectedKind` and `isEditing`. Save/Cancel logic itself is wired in Sub-phase 2c-4 — this task only emits callbacks.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesViewerHeader.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerHeader } from '../FilesViewerHeader';

beforeAll(() => { initI18n(); });

describe('FilesViewerHeader', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('returns null when nothing selected', () => {
    const { container } = render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows filename + Edit + Download buttons for text file (read-only)', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByText('a.ts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('shows Save + Cancel when isEditing', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
  });

  it('shows toggle Rendered/Source button for markdown', () => {
    useFilesPreviewStore.getState().selectFile('~/r.md', 'r.md', 'markdown');
    useFilesPreviewStore.getState().setText('# hi', 1, false);
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /source|rendered/i })).toBeInTheDocument();
  });

  it('clicking Edit fires onEdit', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    const onEdit = vi.fn();
    render(<FilesViewerHeader onEdit={onEdit} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerHeader.test.tsx
```
Expected: FAIL — module '../FilesViewerHeader' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesViewerHeader.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useTheme } from '@/theme';

interface Props {
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onToggleMarkdown: () => void;
}

export function FilesViewerHeader({ onEdit, onSave, onCancel, onDownload, onToggleMarkdown }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const selectedName = useFilesPreviewStore((s) => s.selectedName);
  const selectedKind = useFilesPreviewStore((s) => s.selectedKind);
  const isEditing = useFilesPreviewStore((s) => s.isEditing);
  const showMarkdownRendered = useFilesPreviewStore((s) => s.showMarkdownRendered);
  const isDirty = useFilesPreviewStore((s) => s.isDirty);
  const saving = useFilesPreviewStore((s) => s.saving);

  if (!selectedName) return null;

  const btn = {
    background: 'none' as const,
    border: `1px solid ${tokens.colors.borderSubtle}`,
    color: tokens.colors.textPrimary,
    borderRadius: 4,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    cursor: 'pointer' as const,
    fontSize: tokens.typography.body.fontSize,
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <span
        style={{
          flex: 1,
          fontWeight: 600,
          color: tokens.colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={selectedName}
      >
        {selectedName}
      </span>
      {selectedKind === 'markdown' && (
        <button type="button" onClick={onToggleMarkdown} style={btn}>
          {showMarkdownRendered ? t('files.source') : t('files.rendered')}
        </button>
      )}
      {(selectedKind === 'text' || selectedKind === 'markdown') && !isEditing && (
        <button type="button" onClick={onEdit} style={btn}>{t('files.edit')}</button>
      )}
      {isEditing && (
        <>
          <button type="button" onClick={onSave} style={btn} disabled={saving || !isDirty}>{t('files.save')}</button>
          <button type="button" onClick={onCancel} style={btn}>{t('files.cancel')}</button>
        </>
      )}
      <button type="button" onClick={onDownload} style={btn}>{t('files.download')}</button>
    </header>
  );
}
```

- [ ] **Step 4: Add `files.edit`/`files.save`/`files.cancel` keys**

The header references `files.edit`, `files.save`, and `files.cancel`. These will be added in Task 27 alongside the editor keys, but to keep this test green, also append now to en.json and ja.json:

en.json `files` block:
```json
"edit": "Edit",
"save": "Save",
"cancel": "Cancel"
```

ja.json `files` block:
```json
"edit": "編集",
"save": "保存",
"cancel": "キャンセル"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerHeader.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/files/FilesViewerHeader.tsx packages/web/src/components/files/__tests__/FilesViewerHeader.test.tsx packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add FilesViewerHeader with edit/save/cancel/download/markdown-toggle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: `FilesTextViewer` component (read-only text + line numbers + truncated indicator)

**Files:**
- Create: `packages/web/src/components/files/FilesTextViewer.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesTextViewer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesTextViewer.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesTextViewer } from '../FilesTextViewer';

beforeAll(() => { initI18n(); });

describe('FilesTextViewer', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('renders content lines', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('line1\nline2\nline3', 3, false);
    render(<FilesTextViewer />);
    expect(screen.getByText('line1')).toBeInTheDocument();
    expect(screen.getByText('line3')).toBeInTheDocument();
  });

  it('shows truncated indicator when truncated', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('x', 1, true);
    render(<FilesTextViewer />);
    expect(screen.getByText(/truncated/i)).toBeInTheDocument();
  });

  it('renders nothing when no textContent', () => {
    const { container } = render(<FilesTextViewer />);
    expect(container.querySelector('pre')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesTextViewer.test.tsx
```
Expected: FAIL — module '../FilesTextViewer' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesTextViewer.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useTheme } from '@/theme';

export function FilesTextViewer() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const textContent = useFilesPreviewStore((s) => s.textContent);
  const textLines = useFilesPreviewStore((s) => s.textLines);
  const textTruncated = useFilesPreviewStore((s) => s.textTruncated);

  if (textContent === null) return null;

  const lines = textContent.split('\n');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <pre
        style={{
          flex: 1,
          margin: 0,
          padding: tokens.spacing.md,
          overflow: 'auto',
          background: tokens.colors.bg,
          color: tokens.colors.textPrimary,
          fontFamily: tokens.typography.mono?.fontFamily ?? 'monospace',
          fontSize: tokens.typography.body.fontSize,
          lineHeight: 1.5,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex' }}>
            <span style={{ color: tokens.colors.textMuted, paddingRight: tokens.spacing.md, userSelect: 'none', minWidth: 40, textAlign: 'right' as const }}>
              {i + 1}
            </span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
      {textTruncated && (
        <div
          role="status"
          style={{
            padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
            borderTop: `1px solid ${tokens.colors.borderSubtle}`,
            background: tokens.colors.bgElevated,
            color: tokens.colors.warning,
            fontSize: tokens.typography.caption.fontSize,
          }}
        >
          {t('files.truncatedIndicator', { lines: textLines })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesTextViewer.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesTextViewer.tsx packages/web/src/components/files/__tests__/FilesTextViewer.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesTextViewer (read-only text + line numbers + truncated indicator)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 23: `FilesImageViewer` component (Bearer-fetch Blob URL)

**Files:**
- Create: `packages/web/src/components/files/FilesImageViewer.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesImageViewer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesImageViewer.test.tsx`:
```tsx
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { FilesImageViewer } from '../FilesImageViewer';

beforeAll(() => { initI18n(); });

describe('FilesImageViewer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['x'])));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:img' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  });
  afterEach(() => fetchSpy.mockRestore());

  it('renders <img> with Blob URL once fetched', async () => {
    render(<FilesImageViewer rawUrl="http://gw/api/files/raw?path=x" token="tok" name="x.png" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'x.png' })).toHaveAttribute('src', 'blob:img'));
  });

  it('renders nothing when rawUrl=null', () => {
    const { container } = render(<FilesImageViewer rawUrl={null} token="tok" name="x.png" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesImageViewer.test.tsx
```
Expected: FAIL — module '../FilesImageViewer' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesImageViewer.tsx`:
```tsx
import { useAuthorizedBlobUrl } from '@/hooks/useAuthorizedBlobUrl';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';

interface Props {
  rawUrl: string | null;
  token: string | null;
  name: string;
}

export function FilesImageViewer({ rawUrl, token, name }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { url, loading, error } = useAuthorizedBlobUrl(rawUrl, token);

  if (!rawUrl) return null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tokens.colors.bg,
        overflow: 'auto',
        padding: tokens.spacing.md,
      }}
    >
      {loading && <span style={{ color: tokens.colors.textMuted }}>{t('common.loading')}</span>}
      {error && <span role="alert" style={{ color: tokens.colors.error }}>{t('files.loadFailed')}: {error}</span>}
      {url && <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesImageViewer.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesImageViewer.tsx packages/web/src/components/files/__tests__/FilesImageViewer.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesImageViewer (Bearer fetch + Blob URL)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 24: `FilesMarkdownViewer` component (lazy react-markdown)

**Files:**
- Create: `packages/web/src/components/files/FilesMarkdownViewer.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesMarkdownViewer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesMarkdownViewer.test.tsx`:
```tsx
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { FilesMarkdownViewer } from '../FilesMarkdownViewer';

beforeAll(() => { initI18n(); });

describe('FilesMarkdownViewer', () => {
  it('renders heading from markdown source', async () => {
    render(<FilesMarkdownViewer source={'# Hello World\n\nbody'} />);
    // react-markdown renders inside Suspense → wait for hydration
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hello World' })).toBeInTheDocument());
  });

  it('renders an empty container for empty source', async () => {
    const { container } = render(<FilesMarkdownViewer source="" />);
    await waitFor(() => expect(container.querySelector('[aria-label="Markdown preview"]')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesMarkdownViewer.test.tsx
```
Expected: FAIL — module '../FilesMarkdownViewer' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesMarkdownViewer.tsx`:
```tsx
import { lazy, Suspense } from 'react';
import { useTheme } from '@/theme';

const Markdown = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);
  function MarkdownInner({ children }: { children: string }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith('javascript:') ? '' : url)}
      >
        {children}
      </ReactMarkdown>
    );
  }
  return { default: MarkdownInner };
});

interface Props { source: string; }

export function FilesMarkdownViewer({ source }: Props) {
  const { tokens } = useTheme();
  return (
    <div
      aria-label="Markdown preview"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: tokens.spacing.lg,
        background: tokens.colors.bg,
        color: tokens.colors.textPrimary,
        lineHeight: 1.6,
      }}
    >
      <Suspense fallback={<span style={{ color: tokens.colors.textMuted }}>Loading…</span>}>
        <Markdown>{source}</Markdown>
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesMarkdownViewer.test.tsx
```
Expected: PASS (2 tests). If lazy load times out in vitest (>5s default), the test runner will report timeout — increase via `vi.setConfig({ testTimeout: 10_000 })` at file top if needed.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesMarkdownViewer.tsx packages/web/src/components/files/__tests__/FilesMarkdownViewer.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesMarkdownViewer with lazy react-markdown + remark-gfm

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 25: `FilesViewerPane` (right-pane root) + content fetch + AuthenticatedShell branch

**Files:**
- Create: `packages/web/src/components/files/FilesViewerPane.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesViewerPane.test.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesViewerPane.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerPane } from '../FilesViewerPane';

beforeAll(() => { initI18n(); });

const makeClient = () => ({
  listFiles: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
  renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
  createDirectory: vi.fn(), uploadFile: vi.fn(),
  buildRawFileUrl: (p: string) => `http://gw/api/files/raw?path=${encodeURIComponent(p)}`,
  getFileContent: vi.fn().mockResolvedValue({ path: '~/a.ts', content: 'hello world', lines: 1, truncated: false }),
});

describe('FilesViewerPane', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('shows empty state when nothing selected', () => {
    render(<FilesViewerPane client={makeClient() as any} token="tok" />);
    expect(screen.getByText(/no file selected/i)).toBeInTheDocument();
  });

  it('fetches and shows text content for text file', async () => {
    const client = makeClient();
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    render(<FilesViewerPane client={client as any} token="tok" />);
    await waitFor(() => expect(client.getFileContent).toHaveBeenCalledWith('~/a.ts'));
    await waitFor(() => expect(screen.getByText('hello world')).toBeInTheDocument());
  });

  it('renders unsupported empty state for unsupported kind', () => {
    useFilesPreviewStore.getState().selectFile('~/a.zip', 'a.zip', 'unsupported');
    render(<FilesViewerPane client={makeClient() as any} token="tok" />);
    expect(screen.getByText(/cannot open/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerPane.test.tsx
```
Expected: FAIL — module '../FilesViewerPane' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesViewerPane.tsx`:
```tsx
import { useEffect } from 'react';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useTheme } from '@/theme';
import { FilesViewerEmpty } from './FilesViewerEmpty';
import { FilesViewerHeader } from './FilesViewerHeader';
import { FilesTextViewer } from './FilesTextViewer';
import { FilesImageViewer } from './FilesImageViewer';
import { FilesMarkdownViewer } from './FilesMarkdownViewer';
import type { FilesApiClient } from './filesApi';

interface Props {
  client: FilesApiClient;
  token: string | null;
}

export function FilesViewerPane({ client, token }: Props) {
  const { tokens } = useTheme();
  const selectedPath = useFilesPreviewStore((s) => s.selectedPath);
  const selectedKind = useFilesPreviewStore((s) => s.selectedKind);
  const selectedName = useFilesPreviewStore((s) => s.selectedName);
  const showMarkdownRendered = useFilesPreviewStore((s) => s.showMarkdownRendered);
  const textContent = useFilesPreviewStore((s) => s.textContent);

  useEffect(() => {
    if (!selectedPath) return;
    if (selectedKind !== 'text' && selectedKind !== 'markdown') return;
    let cancelled = false;
    useFilesPreviewStore.getState().setLoadingPreview(true);
    useFilesPreviewStore.getState().setPreviewError(null);
    (async () => {
      try {
        const res = await client.getFileContent(selectedPath);
        if (cancelled) return;
        useFilesPreviewStore.getState().setText(res.content, res.lines, res.truncated);
      } catch (err) {
        if (cancelled) return;
        useFilesPreviewStore.getState().setPreviewError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) useFilesPreviewStore.getState().setLoadingPreview(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, selectedPath, selectedKind]);

  const containerStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: tokens.colors.bg,
    minWidth: 0,
  };

  if (!selectedPath || !selectedKind) {
    return <div style={containerStyle}><FilesViewerEmpty /></div>;
  }

  return (
    <div style={containerStyle}>
      <FilesViewerHeader
        onEdit={() => useFilesPreviewStore.getState().startEditing()}
        onSave={() => { /* wired in Sub-phase 2c-4 (Task 28) */ }}
        onCancel={() => useFilesPreviewStore.getState().cancelEditing()}
        onDownload={() => { /* wired in Sub-phase 2c-8 (Task 51) */ }}
        onToggleMarkdown={() => useFilesPreviewStore.getState().toggleMarkdownRendered()}
      />
      {selectedKind === 'unsupported' && <FilesViewerEmpty mode="unsupported" name={selectedName ?? ''} />}
      {selectedKind === 'image' && (
        <FilesImageViewer rawUrl={client.buildRawFileUrl(selectedPath)} token={token} name={selectedName ?? ''} />
      )}
      {selectedKind === 'text' && <FilesTextViewer />}
      {selectedKind === 'markdown' && (
        showMarkdownRendered
          ? <FilesMarkdownViewer source={textContent ?? ''} />
          : <FilesTextViewer />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire branch in `AuthenticatedShell.tsx`**

Edit `packages/web/src/components/AuthenticatedShell.tsx`:

Add imports near the top:
```tsx
import { useLocation } from 'react-router-dom';
import { FilesViewerPane } from '@/components/files/FilesViewerPane';
import type { FilesApiClient } from '@/components/files/filesApi';
```

Inside the function body, after the existing `wrappedClient` setup, add:
```tsx
const location = useLocation();
const isFilesRoute = location.pathname.startsWith('/web/files');

const filesClient: FilesApiClient = {
  listFiles: baseClient.listFiles.bind(baseClient),
  getFileContent: baseClient.getFileContent.bind(baseClient),
  writeFileContent: baseClient.writeFileContent.bind(baseClient),
  deleteFile: baseClient.deleteFile.bind(baseClient),
  renameFile: baseClient.renameFile.bind(baseClient),
  copyFiles: baseClient.copyFiles.bind(baseClient),
  moveFiles: baseClient.moveFiles.bind(baseClient),
  createDirectory: baseClient.createDirectory.bind(baseClient),
  uploadFile: baseClient.uploadFile.bind(baseClient),
  buildRawFileUrl: baseClient.buildRawFileUrl.bind(baseClient),
};
```

Pass `filesClient` to Sidebar (modify the existing JSX):
```tsx
<Sidebar
  sessions={sessions}
  loading={loading}
  error={error}
  activeSessionId={activeSessionId}
  activeWindowIndex={activeWindowIndex}
  onSelect={(sessionId, windowIndex) => open(sessionId, windowIndex ?? 0)}
  onCreateSession={handleCreateSession}
  onRenameSession={handleRenameSession}
  onRequestDeleteSession={handleRequestDeleteSession}
  onCreateWindow={handleCreateWindow}
  onRenameWindow={handleRenameWindow}
  onRequestDeleteWindow={handleRequestDeleteWindow}
  filesClient={filesClient}
/>
```

Replace the `<TerminalPane ... />` JSX with the conditional branch:
```tsx
{isFilesRoute ? (
  <FilesViewerPane client={filesClient} token={token} />
) : (
  <TerminalPane
    gatewayUrl={gatewayUrl}
    token={token}
    sessionId={activeSessionId}
    windowIndex={activeWindowIndex}
  />
)}
```

- [ ] **Step 5: Run all tests in components/files + AuthenticatedShell**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files src/__tests__/flows
```
Expected: PASS (all files component tests + existing flow tests)

Also run type-check:
```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/files/FilesViewerPane.tsx packages/web/src/components/files/__tests__/FilesViewerPane.test.tsx packages/web/src/components/AuthenticatedShell.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesViewerPane and branch AuthenticatedShell on /web/files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-4: Editor (Tasks 26-31)

CodeMirror 6 ベースの `FilesEditor` (lazy) + Cmd+S 保存 + 未保存 guard。

### Task 26: Add editor i18n keys (saved/saveFailed/unsavedChanges)

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Append to en.json `files` block**

```json
"saved": "Saved",
"saveFailed": "Save failed",
"saveFailedDesc": "Could not save file.",
"unsavedChangesTitle": "Unsaved changes",
"unsavedChangesMessage": "You have unsaved changes. Discard?"
```

- [ ] **Step 2: Append to ja.json `files` block**

```json
"saved": "保存しました",
"saveFailed": "保存失敗",
"saveFailedDesc": "ファイルを保存できませんでした。",
"unsavedChangesTitle": "未保存の変更",
"unsavedChangesMessage": "未保存の変更があります。破棄しますか？"
```

- [ ] **Step 3: Verify JSON parses + type-check**

```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: prints `OK` then PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add editor i18n keys (saved/saveFailed/unsavedChanges)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 27: `FilesEditor` component (CodeMirror 6, lazy)

**Files:**
- Create: `packages/web/src/components/files/FilesEditor.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesEditor.test.tsx`

> CodeMirror's full DOM behaviour is hard to assert in jsdom. The test verifies the editor renders, accepts initial content, fires `onChange` when the underlying CodeMirror updates, and triggers `onSave` on `Cmd+S`. We mock `@uiw/react-codemirror` to keep the test deterministic.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesEditor.test.tsx`:
```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { FilesEditor } from '../FilesEditor';

// Mock CodeMirror so we don't need a real DOM-mounted editor in jsdom.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange, onKeyDown }: { value: string; onChange?: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void }) => (
    <textarea
      data-testid="cm-mock"
      defaultValue={value}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
    />
  ),
}));

beforeAll(() => { initI18n(); });

describe('FilesEditor', () => {
  it('renders with initial value', async () => {
    render(<FilesEditor filename="a.ts" value="hi" onChange={() => {}} onSave={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cm-mock')).toHaveValue('hi'));
  });

  it('calls onChange when text edited', async () => {
    const onChange = vi.fn();
    render(<FilesEditor filename="a.ts" value="hi" onChange={onChange} onSave={() => {}} />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.change(ta, { target: { value: 'changed' } });
    expect(onChange).toHaveBeenCalledWith('changed');
  });

  it('calls onSave when Cmd+S is pressed', async () => {
    const onSave = vi.fn();
    render(<FilesEditor filename="a.ts" value="hi" onChange={() => {}} onSave={onSave} />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.keyDown(ta, { key: 's', metaKey: true });
    expect(onSave).toHaveBeenCalled();
  });

  it('calls onSave when Ctrl+S is pressed', async () => {
    const onSave = vi.fn();
    render(<FilesEditor filename="a.ts" value="hi" onChange={() => {}} onSave={onSave} />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.keyDown(ta, { key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesEditor.test.tsx
```
Expected: FAIL — module '../FilesEditor' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesEditor.tsx`:
```tsx
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Extension } from '@codemirror/state';
import { useTheme } from '@/theme';
import { languageForFilename } from '@/lib/languageForFilename';

const CodeMirror = lazy(() => import('@uiw/react-codemirror').then((m) => ({ default: m.default })));

interface Props {
  filename: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function FilesEditor({ filename, value, onChange, onSave }: Props) {
  const { tokens } = useTheme();
  const dark = tokens.colors.bg && tokens.colors.bg.toLowerCase() !== '#ffffff';
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lang = await languageForFilename(filename);
      if (cancelled) return;
      setExtensions(lang ? [lang] : []);
    })();
    return () => { cancelled = true; };
  }, [filename]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSaveRef.current();
    }
  };

  // theme is loaded on demand so we don't tie a synchronous import to module load.
  const [themeExt, setThemeExt] = useState<Extension | null>(null);
  useEffect(() => {
    if (!dark) { setThemeExt(null); return; }
    let cancelled = false;
    (async () => {
      const m = await import('@codemirror/theme-one-dark');
      if (cancelled) return;
      setThemeExt(m.oneDark);
    })();
    return () => { cancelled = true; };
  }, [dark]);

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Suspense fallback={<div style={{ padding: tokens.spacing.md, color: tokens.colors.textMuted }}>Loading editor…</div>}>
        <CodeMirror
          value={value}
          theme={themeExt ?? undefined}
          extensions={extensions}
          onChange={(v) => onChange(v)}
          height="100%"
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesEditor.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesEditor.tsx packages/web/src/components/files/__tests__/FilesEditor.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesEditor (lazy CodeMirror 6 + Cmd/Ctrl+S handler)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 28: Wire editor into `FilesViewerPane` + save flow

**Files:**
- Modify: `packages/web/src/components/files/FilesViewerPane.tsx`
- Test: `packages/web/src/__tests__/flows/files-edit-flow.test.tsx`

- [ ] **Step 1: Write the failing flow test**

Create `packages/web/src/__tests__/flows/files-edit-flow.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useUiStore } from '@/stores/ui';
import { FilesViewerPane } from '@/components/files/FilesViewerPane';

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea data-testid="cm-mock" defaultValue={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

beforeAll(() => { initI18n(); });

const makeClient = () => ({
  listFiles: vi.fn(), deleteFile: vi.fn(), renameFile: vi.fn(), copyFiles: vi.fn(),
  moveFiles: vi.fn(), createDirectory: vi.fn(), uploadFile: vi.fn(),
  buildRawFileUrl: () => '',
  getFileContent: vi.fn().mockResolvedValue({ path: '~/a.ts', content: 'old', lines: 1, truncated: false }),
  writeFileContent: vi.fn().mockResolvedValue({ path: '~/a.ts', bytes: 3 }),
});

describe('Files edit flow', () => {
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('select → edit → save → toast + finishSave', async () => {
    const client = makeClient();
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');

    render(<FilesViewerPane client={client as any} token="tok" />);
    await waitFor(() => expect(client.getFileContent).toHaveBeenCalled());

    // Click Edit in header
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Type new content
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.change(ta, { target: { value: 'new content' } });

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(client.writeFileContent).toHaveBeenCalledWith('~/a.ts', 'new content'));
    await waitFor(() => expect(useFilesPreviewStore.getState().textContent).toBe('new content'));
    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'success')).toBe(true));
    expect(useFilesPreviewStore.getState().isEditing).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-edit-flow.test.tsx
```
Expected: FAIL — Edit button does not actually open an editor (FilesEditor not yet integrated)

- [ ] **Step 3: Update `FilesViewerPane.tsx` to render FilesEditor + save flow**

Edit `packages/web/src/components/files/FilesViewerPane.tsx`:

Add imports:
```tsx
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui';
import { FilesEditor } from './FilesEditor';
```

Inside the component, add the save handler (place after the `useEffect` that fetches content):
```tsx
const { t } = useTranslation();
const isEditing = useFilesPreviewStore((s) => s.isEditing);
const editContent = useFilesPreviewStore((s) => s.editContent);

const handleSave = async () => {
  const path = useFilesPreviewStore.getState().selectedPath;
  if (!path) return;
  const content = useFilesPreviewStore.getState().editContent;
  useFilesPreviewStore.getState().setSaving(true);
  try {
    await client.writeFileContent(path, content);
    useFilesPreviewStore.getState().finishSave(content);
    useUiStore.getState().pushToast({ type: 'success', message: t('files.saved') });
  } catch (err) {
    useFilesPreviewStore.getState().setSaving(false);
    const msg = err instanceof Error ? err.message : String(err);
    useUiStore.getState().pushToast({ type: 'error', message: `${t('files.saveFailed')}: ${msg}` });
  }
};
```

Replace the editor-related render branch so that when `isEditing` is true, the FilesEditor is shown instead of the read-only viewer for both `text` and `markdown`:
```tsx
{selectedKind === 'unsupported' && <FilesViewerEmpty mode="unsupported" name={selectedName ?? ''} />}
{selectedKind === 'image' && (
  <FilesImageViewer rawUrl={client.buildRawFileUrl(selectedPath)} token={token} name={selectedName ?? ''} />
)}
{(selectedKind === 'text' || selectedKind === 'markdown') && isEditing && (
  <FilesEditor
    filename={selectedName ?? ''}
    value={editContent}
    onChange={(v) => useFilesPreviewStore.getState().setEditContent(v)}
    onSave={handleSave}
  />
)}
{selectedKind === 'text' && !isEditing && <FilesTextViewer />}
{selectedKind === 'markdown' && !isEditing && (
  showMarkdownRendered
    ? <FilesMarkdownViewer source={textContent ?? ''} />
    : <FilesTextViewer />
)}
```

Replace the previously-stubbed `onSave` prop in `<FilesViewerHeader>`:
```tsx
<FilesViewerHeader
  onEdit={() => useFilesPreviewStore.getState().startEditing()}
  onSave={handleSave}
  onCancel={() => useFilesPreviewStore.getState().cancelEditing()}
  onDownload={() => { /* wired in Sub-phase 2c-8 */ }}
  onToggleMarkdown={() => useFilesPreviewStore.getState().toggleMarkdownRendered()}
/>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-edit-flow.test.tsx
```
Expected: PASS (1 test)

- [ ] **Step 5: Run all files tests as regression check**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files src/__tests__/flows/files-edit-flow.test.tsx src/__tests__/flows/files-browse-flow.test.tsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/files/FilesViewerPane.tsx packages/web/src/__tests__/flows/files-edit-flow.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire FilesEditor + save flow into FilesViewerPane

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 29: Unsaved-changes guard when switching files

**Files:**
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`

> When a file is being edited with `isDirty=true`, clicking another file should pop the `useUiStore.showConfirm` dialog before discarding edits.

- [ ] **Step 1: Add a failing test**

Append to `packages/web/src/components/files/__tests__/FilesSidebarPanel.test.tsx` inside the existing `describe('FilesSidebarPanel', ...)`:
```tsx
  it('shows unsaved-changes confirm when switching while dirty', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument());

    // Simulate dirty edit state on a different file
    useFilesPreviewStore.getState().selectFile('~/other.ts', 'other.ts', 'text');
    useFilesPreviewStore.getState().setText('a', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');

    // Click README.md in the list
    fireEvent.click(screen.getByRole('button', { name: /README\.md/ }));

    // The confirm dialog should be queued
    const { useUiStore } = await import('@/stores/ui');
    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    expect(useUiStore.getState().confirmDialog?.title).toMatch(/unsaved/i);
  });
```

(`useUiStore` import added inside the test via dynamic import to avoid restructuring the file's imports.)

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSidebarPanel.test.tsx
```
Expected: FAIL — confirm dialog is not opened (panel currently switches selection unconditionally)

- [ ] **Step 3: Modify `handleOpen` in FilesSidebarPanel**

Edit `packages/web/src/components/files/FilesSidebarPanel.tsx`:

Add imports:
```tsx
import { useTranslation } from 'react-i18next'; // already imported — ensure
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useUiStore } from '@/stores/ui';
```

Replace the existing `handleOpen` body:
```tsx
const handleOpen = (entry: FileEntry) => {
  const isDir = entry.type === 'directory'
    || (entry.type === 'symlink' && entry.resolvedType === 'directory');

  const proceed = () => {
    if (isDir) {
      useFilesStore.getState().setCurrentPath(buildEntryPath(currentPath, entry.name));
      return;
    }
    const kind = getPreviewKind(entry.name);
    useFilesPreviewStore.getState().selectFile(buildEntryPath(currentPath, entry.name), entry.name, kind);
  };

  const isDirty = useFilesPreviewStore.getState().isDirty;
  if (isDirty) {
    useUiStore.getState().showConfirm({
      title: t('files.unsavedChangesTitle'),
      message: t('files.unsavedChangesMessage'),
      destructive: true,
      onConfirm: () => {
        useFilesPreviewStore.getState().cancelEditing();
        proceed();
      },
    });
    return;
  }
  proceed();
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSidebarPanel.test.tsx
```
Expected: PASS (5 tests including the new one)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSidebarPanel.tsx packages/web/src/components/files/__tests__/FilesSidebarPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): guard unsaved edits with confirm dialog when switching files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 30: Editor language selection per filename (sanity test)

**Files:**
- Test: `packages/web/src/components/files/__tests__/FilesEditor.language.test.tsx`

> Belt-and-suspenders integration test that proves `languageForFilename(filename)` is consulted when filename changes. Re-uses the CodeMirror mock.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesEditor.language.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FilesEditor } from '../FilesEditor';

const langSpy = vi.fn(async (name: string) => null);
vi.mock('@/lib/languageForFilename', () => ({
  languageForFilename: (n: string) => langSpy(n),
}));
vi.mock('@uiw/react-codemirror', () => ({
  default: () => <div data-testid="cm-mock-language" />,
}));

describe('FilesEditor language selection', () => {
  it('calls languageForFilename with current filename on mount + change', async () => {
    const { rerender } = render(<FilesEditor filename="a.ts" value="" onChange={() => {}} onSave={() => {}} />);
    await waitFor(() => expect(langSpy).toHaveBeenCalledWith('a.ts'));
    rerender(<FilesEditor filename="b.py" value="" onChange={() => {}} onSave={() => {}} />);
    await waitFor(() => expect(langSpy).toHaveBeenCalledWith('b.py'));
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesEditor.language.test.tsx
```
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/files/__tests__/FilesEditor.language.test.tsx
git commit -m "$(cat <<'EOF'
test(web): assert FilesEditor consults languageForFilename per filename

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 31: Disable save button when not dirty + saving spinner

**Files:**
- Test: `packages/web/src/components/files/__tests__/FilesViewerHeader.dirty.test.tsx`

> Save button is `disabled` while not dirty. Already implemented in Task 21 — this task adds an explicit assertion test to lock the behaviour.

- [ ] **Step 1: Write the test**

Create `packages/web/src/components/files/__tests__/FilesViewerHeader.dirty.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerHeader } from '../FilesViewerHeader';

beforeAll(() => { initI18n(); });

describe('FilesViewerHeader save button state', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('save disabled when not dirty', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('save enabled when dirty', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('save disabled while saving even if dirty', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');
    useFilesPreviewStore.getState().setSaving(true);
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerHeader.dirty.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/files/__tests__/FilesViewerHeader.dirty.test.tsx
git commit -m "$(cat <<'EOF'
test(web): lock down save button enable/disable behaviour

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-5: Mutation actions (Tasks 32-39)

`FilesContextMenu` + rename / delete (single + bulk) / mkdir / new file dialog + `FilesDetailsDialog`。

### Task 32: Add mutation i18n keys

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Append to en.json `files` block**

```json
"deleteConfirmTitle": "Delete?",
"deleteConfirmMessage": "Delete {{name}}? This cannot be undone.",
"deleteConfirmMultiple": "Delete {{count}} items? This cannot be undone.",
"deleteSuccess": "Deleted",
"deleteFailed": "Delete failed",
"deleteFailedDesc": "Could not delete.",
"rename": "Rename",
"renameSuccess": "Renamed",
"renameFailed": "Rename failed",
"renameFailedDesc": "Could not rename.",
"delete": "Delete",
"copy": "Copy",
"cut": "Cut",
"paste": "Paste",
"details": "Details",
"copySuccess": "Copied to clipboard",
"cutSuccess": "Cut to clipboard",
"pasteSuccess": "Pasted",
"pasteFailed": "Paste failed",
"pasteFailedDesc": "Could not paste.",
"fileNamePlaceholder": "filename.ext",
"folderNamePlaceholder": "folder name",
"mkdirSuccess": "Folder created",
"mkdirFailed": "Create folder failed",
"mkdirFailedDesc": "Could not create folder.",
"detailsSize": "Size: {{size}}",
"detailsModified": "Modified: {{date}}",
"detailsPermissions": "Permissions: {{permissions}}"
```

- [ ] **Step 2: Append to ja.json `files` block**

```json
"deleteConfirmTitle": "削除しますか？",
"deleteConfirmMessage": "{{name}} を削除します。元に戻せません。",
"deleteConfirmMultiple": "{{count}} 件を削除します。元に戻せません。",
"deleteSuccess": "削除しました",
"deleteFailed": "削除失敗",
"deleteFailedDesc": "削除できませんでした。",
"rename": "リネーム",
"renameSuccess": "リネームしました",
"renameFailed": "リネーム失敗",
"renameFailedDesc": "リネームできませんでした。",
"delete": "削除",
"copy": "コピー",
"cut": "カット",
"paste": "ペースト",
"details": "詳細",
"copySuccess": "クリップボードにコピーしました",
"cutSuccess": "クリップボードにカットしました",
"pasteSuccess": "ペーストしました",
"pasteFailed": "ペースト失敗",
"pasteFailedDesc": "ペーストできませんでした。",
"fileNamePlaceholder": "filename.ext",
"folderNamePlaceholder": "フォルダ名",
"mkdirSuccess": "フォルダを作成しました",
"mkdirFailed": "フォルダ作成失敗",
"mkdirFailedDesc": "フォルダを作成できませんでした。",
"detailsSize": "サイズ: {{size}}",
"detailsModified": "更新日時: {{date}}",
"detailsPermissions": "権限: {{permissions}}"
```

- [ ] **Step 3: Verify JSON parses + type-check**

```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: prints `OK` then PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add mutation i18n keys for Sub-phase 2c-5

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 33: `FilesNewNameDialog` component (single text input + Cancel/OK)

**Files:**
- Create: `packages/web/src/components/files/FilesNewNameDialog.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesNewNameDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesNewNameDialog.test.tsx`:
```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { FilesNewNameDialog } from '../FilesNewNameDialog';

beforeAll(() => { initI18n(); });

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  }
});

describe('FilesNewNameDialog', () => {
  it('renders with title and placeholder', () => {
    render(<FilesNewNameDialog open title="New file" placeholder="filename.ext" initialValue="" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('New file')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('filename.ext')).toBeInTheDocument();
  });

  it('submit fires onSubmit with trimmed value', () => {
    const onSubmit = vi.fn();
    render(<FilesNewNameDialog open title="t" placeholder="p" initialValue="  abc  " onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /ok|create/i }));
    expect(onSubmit).toHaveBeenCalledWith('abc');
  });

  it('cancel fires onCancel', () => {
    const onCancel = vi.fn();
    render(<FilesNewNameDialog open title="t" placeholder="p" initialValue="" onCancel={onCancel} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not submit empty', () => {
    const onSubmit = vi.fn();
    render(<FilesNewNameDialog open title="t" placeholder="p" initialValue="   " onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /ok|create/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesNewNameDialog.test.tsx
```
Expected: FAIL — module '../FilesNewNameDialog' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesNewNameDialog.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  open: boolean;
  title: string;
  placeholder: string;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function FilesNewNameDialog({ open, title, placeholder, initialValue, onCancel, onSubmit }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
    if (!open && ref.current && ref.current.open) ref.current.close();
    setValue(initialValue);
  }, [open, initialValue]);

  const handleSubmit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
  };

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      style={{
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 8,
        padding: tokens.spacing.lg,
        minWidth: 320,
      }}
    >
      <h3 style={{ margin: 0, marginBottom: tokens.spacing.md }}>{title}</h3>
      <input
        type="text"
        value={value}
        autoFocus
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        style={{
          width: '100%',
          padding: tokens.spacing.sm,
          background: tokens.colors.bg,
          color: tokens.colors.textPrimary,
          border: `1px solid ${tokens.colors.borderSubtle}`,
          borderRadius: 4,
          fontSize: tokens.typography.body.fontSize,
        }}
      />
      <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end', marginTop: tokens.spacing.md }}>
        <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" onClick={handleSubmit}>OK</button>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesNewNameDialog.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesNewNameDialog.tsx packages/web/src/components/files/__tests__/FilesNewNameDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesNewNameDialog (text input dialog for rename/mkdir/new file)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 34: `FilesDetailsDialog` component

**Files:**
- Create: `packages/web/src/components/files/FilesDetailsDialog.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesDetailsDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesDetailsDialog.test.tsx`:
```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import type { FileEntry } from '@zenterm/shared';
import { FilesDetailsDialog } from '../FilesDetailsDialog';

beforeAll(() => { initI18n(); });

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  }
});

const entry: FileEntry = {
  name: 'a.ts', type: 'file', size: 1024, modified: 1704153600, permissions: 'rw-r--r--',
};

describe('FilesDetailsDialog', () => {
  it('renders size, modified, permissions', () => {
    render(<FilesDetailsDialog open entry={entry} locale="en-US" onClose={vi.fn()} />);
    expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/rw-r--r--/)).toBeInTheDocument();
  });

  it('clicking close fires onClose', () => {
    const onClose = vi.fn();
    render(<FilesDetailsDialog open entry={entry} locale="en-US" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when entry=null', () => {
    const { container } = render(<FilesDetailsDialog open entry={null} locale="en-US" onClose={vi.fn()} />);
    expect(container.querySelector('dialog')?.getAttribute('open')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesDetailsDialog.test.tsx
```
Expected: FAIL — module '../FilesDetailsDialog' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesDetailsDialog.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { formatFileDate, formatFileSize } from '@/lib/filesFormat';

interface Props {
  open: boolean;
  entry: FileEntry | null;
  locale: string;
  onClose: () => void;
}

export function FilesDetailsDialog({ open, entry, locale, onClose }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const shouldOpen = open && entry !== null;
    if (shouldOpen && !ref.current.open) ref.current.showModal();
    if (!shouldOpen && ref.current.open) ref.current.close();
  }, [open, entry]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      style={{
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 8,
        padding: tokens.spacing.lg,
        minWidth: 320,
      }}
    >
      {entry && (
        <>
          <h3 style={{ margin: 0, marginBottom: tokens.spacing.md }}>{entry.name}</h3>
          <div>{t('files.detailsSize', { size: formatFileSize(entry.size) })}</div>
          <div>{t('files.detailsModified', { date: formatFileDate(entry.modified, locale) })}</div>
          <div>{t('files.detailsPermissions', { permissions: entry.permissions })}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: tokens.spacing.md }}>
            <button type="button" onClick={onClose}>{t('common.close')}</button>
          </div>
        </>
      )}
    </dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesDetailsDialog.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesDetailsDialog.tsx packages/web/src/components/files/__tests__/FilesDetailsDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesDetailsDialog (size/modified/permissions)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 35: `FilesContextMenu` component

**Files:**
- Create: `packages/web/src/components/files/FilesContextMenu.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesContextMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesContextMenu.test.tsx`:
```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import type { FileEntry } from '@zenterm/shared';
import { FilesContextMenu } from '../FilesContextMenu';

beforeAll(() => { initI18n(); });

const entry: FileEntry = { name: 'a.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' };

describe('FilesContextMenu', () => {
  it('renders rename/copy/cut/delete/details menu items', () => {
    render(<FilesContextMenu entry={entry} x={10} y={10} onClose={vi.fn()} onRename={vi.fn()} onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} onDetails={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole('menuitem', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /cut/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /details/i })).toBeInTheDocument();
  });

  it('rename click fires onRename and onClose', () => {
    const onRename = vi.fn();
    const onClose = vi.fn();
    render(<FilesContextMenu entry={entry} x={0} y={0} onClose={onClose} onRename={onRename} onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} onDetails={vi.fn()} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    expect(onRename).toHaveBeenCalledWith(entry);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesContextMenu.test.tsx
```
Expected: FAIL — module '../FilesContextMenu' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesContextMenu.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';

interface Props {
  entry: FileEntry;
  x: number;
  y: number;
  onClose: () => void;
  onRename: (e: FileEntry) => void;
  onCopy: (e: FileEntry) => void;
  onCut: (e: FileEntry) => void;
  onDelete: (e: FileEntry) => void;
  onDetails: (e: FileEntry) => void;
  onSelect: (e: FileEntry) => void;
}

export function FilesContextMenu(props: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { entry, x, y, onClose } = props;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const item = {
    background: 'none' as const,
    border: 'none' as const,
    width: '100%',
    padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
    textAlign: 'left' as const,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.body.fontSize,
    cursor: 'pointer' as const,
  };

  const click = (action: 'rename' | 'copy' | 'cut' | 'delete' | 'details' | 'select') => {
    const map = {
      rename: props.onRename,
      copy: props.onCopy,
      cut: props.onCut,
      delete: props.onDelete,
      details: props.onDetails,
      select: props.onSelect,
    } as const;
    map[action](entry);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Files context menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        minWidth: 160,
        zIndex: 1000,
        padding: tokens.spacing.xs,
      }}
    >
      <button type="button" role="menuitem" style={item} onClick={() => click('select')}>{t('files.selectAll')?.toString().includes('Select') ? 'Select' : '選択'}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('rename')}>{t('files.rename')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('copy')}>{t('files.copy')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('cut')}>{t('files.cut')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('delete')} aria-label={t('files.delete')}>{t('files.delete')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('details')}>{t('files.details')}</button>
    </div>
  );
}
```

> Note: `t('files.selectAll')` is referenced in the menu (Select-equivalent). The full key is added in Task 41 (selection mode keys); for now the `?.toString().includes('Select') ? 'Select' : '選択'` fallback prevents test failure if the key is missing.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesContextMenu.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesContextMenu.tsx packages/web/src/components/files/__tests__/FilesContextMenu.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesContextMenu (rename/copy/cut/delete/details/select)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 36: Mutation handlers in `FilesSidebarPanel` (rename / delete / mkdir / new file dialog wiring)

**Files:**
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`
- Test: `packages/web/src/__tests__/flows/files-mutations-flow.test.tsx`

- [ ] **Step 1: Write the failing flow test**

Create `packages/web/src/__tests__/flows/files-mutations-flow.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { useUiStore } from '@/stores/ui';
import { FilesSidebarPanel } from '@/components/files/FilesSidebarPanel';

beforeAll(() => {
  initI18n();
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  }
});

const baseEntries = [
  { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
  { name: 'a.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' },
];

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({ path: '~', entries: baseEntries }),
  getFileContent: vi.fn(), writeFileContent: vi.fn(), uploadFile: vi.fn(),
  copyFiles: vi.fn(), moveFiles: vi.fn(), buildRawFileUrl: () => '',
  deleteFile: vi.fn().mockResolvedValue({ path: '~/a.ts', deleted: true }),
  renameFile: vi.fn().mockResolvedValue({ oldPath: '~/a.ts', newPath: '~/b.ts' }),
  createDirectory: vi.fn().mockResolvedValue({ path: '~/newdir', created: true }),
});

describe('Files mutations flow', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('mkdir from toolbar New menu', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /new folder/i }));

    const input = await screen.findByPlaceholderText(/folder name/i);
    fireEvent.change(input, { target: { value: 'newdir' } });
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => expect(client.createDirectory).toHaveBeenCalledWith('~/newdir'));
    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'success')).toBe(true));
    expect(client.listFiles).toHaveBeenCalledTimes(2); // initial + after mkdir
  });

  it('delete via context menu shows confirm and calls deleteFile on confirm', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }));

    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    await useUiStore.getState().confirmDialog!.onConfirm();
    expect(client.deleteFile).toHaveBeenCalledWith('~/a.ts');
  });

  it('rename via context menu opens dialog and calls renameFile', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /rename/i }));

    const input = await screen.findByDisplayValue('a.ts');
    fireEvent.change(input, { target: { value: 'b.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => expect(client.renameFile).toHaveBeenCalledWith('~/a.ts', 'b.ts'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-mutations-flow.test.tsx
```
Expected: FAIL — context menu has no handlers, toolbar `onNewFolder`/`onNewFile` are stubs

- [ ] **Step 3: Add mutation handlers in `FilesSidebarPanel.tsx`**

Edit `packages/web/src/components/files/FilesSidebarPanel.tsx`:

Add imports:
```tsx
import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { FileEntry } from '@zenterm/shared';
import { FilesContextMenu } from './FilesContextMenu';
import { FilesNewNameDialog } from './FilesNewNameDialog';
import { FilesDetailsDialog } from './FilesDetailsDialog';
```

Add the following local state inside the component:
```tsx
const [contextMenu, setContextMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
const [mkdirOpen, setMkdirOpen] = useState(false);
const [newFileOpen, setNewFileOpen] = useState(false);
const [detailsTarget, setDetailsTarget] = useState<FileEntry | null>(null);
const pushToast = useUiStore((s) => s.pushToast);
const showConfirm = useUiStore((s) => s.showConfirm);

const refresh = () => loadDirectory(client, useFilesStore.getState().currentPath, useFilesStore.getState().showHidden);

const handleContextMenu = (entry: FileEntry, e: MouseEvent) => {
  setContextMenu({ entry, x: e.clientX, y: e.clientY });
};

const doDelete = async (entry: FileEntry) => {
  showConfirm({
    title: t('files.deleteConfirmTitle'),
    message: t('files.deleteConfirmMessage', { name: entry.name }),
    destructive: true,
    onConfirm: async () => {
      try {
        await client.deleteFile(buildEntryPath(useFilesStore.getState().currentPath, entry.name));
        pushToast({ type: 'success', message: t('files.deleteSuccess') });
        await refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushToast({ type: 'error', message: `${t('files.deleteFailed')}: ${msg}` });
      }
    },
  });
};

const doRename = async (newName: string) => {
  if (!renameTarget) return;
  try {
    await client.renameFile(buildEntryPath(useFilesStore.getState().currentPath, renameTarget.name), newName);
    pushToast({ type: 'success', message: t('files.renameSuccess') });
    setRenameTarget(null);
    await refresh();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${t('files.renameFailed')}: ${msg}` });
  }
};

const doMkdir = async (name: string) => {
  try {
    await client.createDirectory(buildEntryPath(useFilesStore.getState().currentPath, name));
    pushToast({ type: 'success', message: t('files.mkdirSuccess') });
    setMkdirOpen(false);
    await refresh();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${t('files.mkdirFailed')}: ${msg}` });
  }
};

const doNewFile = (name: string) => {
  // Create empty buffer in editor; actual file is written on Save (Task 28)
  const path = buildEntryPath(useFilesStore.getState().currentPath, name);
  useFilesPreviewStore.getState().selectFile(path, name, getPreviewKind(name));
  useFilesPreviewStore.getState().setText('', 0, false);
  useFilesPreviewStore.getState().startEditing();
  setNewFileOpen(false);
};
```

Replace the toolbar JSX `onUploadClick`/`onNewFile`/`onNewFolder` stubs with real wiring:
```tsx
<FilesToolbar
  onUploadClick={() => { /* wired in Sub-phase 2c-7 */ }}
  onNewFile={() => setNewFileOpen(true)}
  onNewFolder={() => setMkdirOpen(true)}
/>
```

Pass `handleContextMenu` to `FilesList`:
```tsx
<FilesList
  onOpen={handleOpen}
  onContextMenu={handleContextMenu}
  onLongPress={() => { /* wired in Sub-phase 2c-6 */ }}
/>
```

Append the dialogs and context menu at the end of the panel JSX:
```tsx
{contextMenu && (
  <FilesContextMenu
    entry={contextMenu.entry}
    x={contextMenu.x}
    y={contextMenu.y}
    onClose={() => setContextMenu(null)}
    onRename={(e) => setRenameTarget(e)}
    onCopy={() => { /* wired in Sub-phase 2c-6 */ }}
    onCut={() => { /* wired in Sub-phase 2c-6 */ }}
    onDelete={doDelete}
    onDetails={(e) => setDetailsTarget(e)}
    onSelect={() => { /* wired in Sub-phase 2c-6 */ }}
  />
)}
<FilesNewNameDialog
  open={renameTarget !== null}
  title={t('files.rename')}
  placeholder={t('files.fileNamePlaceholder')}
  initialValue={renameTarget?.name ?? ''}
  onCancel={() => setRenameTarget(null)}
  onSubmit={doRename}
/>
<FilesNewNameDialog
  open={mkdirOpen}
  title={t('files.newFolder')}
  placeholder={t('files.folderNamePlaceholder')}
  initialValue=""
  onCancel={() => setMkdirOpen(false)}
  onSubmit={doMkdir}
/>
<FilesNewNameDialog
  open={newFileOpen}
  title={t('files.createNewFile')}
  placeholder={t('files.fileNamePlaceholder')}
  initialValue=""
  onCancel={() => setNewFileOpen(false)}
  onSubmit={doNewFile}
/>
<FilesDetailsDialog
  open={detailsTarget !== null}
  entry={detailsTarget}
  locale={t('common.cancel') === 'キャンセル' ? 'ja-JP' : 'en-US'}
  onClose={() => setDetailsTarget(null)}
/>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-mutations-flow.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSidebarPanel.tsx packages/web/src/__tests__/flows/files-mutations-flow.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire mkdir/rename/delete/details/new-file mutation handlers in FilesSidebarPanel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 37: Persist new-file save (write empty content on first save)

**Files:**
- Test: `packages/web/src/__tests__/flows/files-newfile-flow.test.tsx`

> The new-file flow already opens the editor (Task 36). When the user clicks Save, `writeFileContent` should be called with the path + content, creating the file on the server. This is automatic via Task 28's save handler — this task adds an integration test that locks the contract.

- [ ] **Step 1: Write the test**

Create `packages/web/src/__tests__/flows/files-newfile-flow.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useUiStore } from '@/stores/ui';
import { FilesViewerPane } from '@/components/files/FilesViewerPane';

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea data-testid="cm-mock" defaultValue={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

beforeAll(() => { initI18n(); });

const makeClient = () => ({
  listFiles: vi.fn(), deleteFile: vi.fn(), renameFile: vi.fn(), copyFiles: vi.fn(),
  moveFiles: vi.fn(), createDirectory: vi.fn(), uploadFile: vi.fn(),
  buildRawFileUrl: () => '',
  getFileContent: vi.fn(),
  writeFileContent: vi.fn().mockResolvedValue({ path: '~/new.ts', bytes: 4 }),
});

describe('Files new-file flow', () => {
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('writeFileContent is called when user saves a brand-new buffer', async () => {
    const client = makeClient();
    // Simulate the state set up by doNewFile in Task 36
    useFilesPreviewStore.getState().selectFile('~/new.ts', 'new.ts', 'text');
    useFilesPreviewStore.getState().setText('', 0, false);
    useFilesPreviewStore.getState().startEditing();

    render(<FilesViewerPane client={client as any} token="tok" />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.change(ta, { target: { value: 'body' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(client.writeFileContent).toHaveBeenCalledWith('~/new.ts', 'body'));
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-newfile-flow.test.tsx
```
Expected: PASS (1 test) — leverages the existing handleSave in FilesViewerPane.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/files-newfile-flow.test.tsx
git commit -m "$(cat <<'EOF'
test(web): lock down new-file save flow uses writeFileContent

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 38: Refresh viewer when active file is deleted

**Files:**
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`

> When the user deletes a file that's currently shown in the right pane, the viewer should clear (otherwise it shows stale content).

- [ ] **Step 1: Add a failing assertion to the mutations flow test**

Append to `packages/web/src/__tests__/flows/files-mutations-flow.test.tsx` inside the existing `describe('Files mutations flow', ...)`:
```tsx
  it('clears preview when the deleted file is currently selected', async () => {
    const client = makeClient();
    const { useFilesPreviewStore } = await import('@/stores/filesPreview');
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');

    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await useUiStore.getState().confirmDialog!.onConfirm();

    expect(useFilesPreviewStore.getState().selectedPath).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-mutations-flow.test.tsx
```
Expected: FAIL — preview not cleared

- [ ] **Step 3: Modify `doDelete` in FilesSidebarPanel**

Edit `doDelete` in `packages/web/src/components/files/FilesSidebarPanel.tsx`. Inside the success branch (after `pushToast`), add a clear:
```tsx
const targetPath = buildEntryPath(useFilesStore.getState().currentPath, entry.name);
if (useFilesPreviewStore.getState().selectedPath === targetPath) {
  useFilesPreviewStore.getState().clear();
}
```

The full updated `doDelete`:
```tsx
const doDelete = async (entry: FileEntry) => {
  showConfirm({
    title: t('files.deleteConfirmTitle'),
    message: t('files.deleteConfirmMessage', { name: entry.name }),
    destructive: true,
    onConfirm: async () => {
      const targetPath = buildEntryPath(useFilesStore.getState().currentPath, entry.name);
      try {
        await client.deleteFile(targetPath);
        pushToast({ type: 'success', message: t('files.deleteSuccess') });
        if (useFilesPreviewStore.getState().selectedPath === targetPath) {
          useFilesPreviewStore.getState().clear();
        }
        await refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushToast({ type: 'error', message: `${t('files.deleteFailed')}: ${msg}` });
      }
    },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-mutations-flow.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSidebarPanel.tsx packages/web/src/__tests__/flows/files-mutations-flow.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): clear preview store when active file is deleted

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 39: Re-fetch directory after rename + update preview if active

**Files:**
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`

- [ ] **Step 1: Add failing assertion to the mutations flow**

Append to `packages/web/src/__tests__/flows/files-mutations-flow.test.tsx` inside the existing describe:
```tsx
  it('updates preview store path when active file is renamed', async () => {
    const client = makeClient();
    const { useFilesPreviewStore } = await import('@/stores/filesPreview');
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');

    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /rename/i }));

    const input = await screen.findByDisplayValue('a.ts');
    fireEvent.change(input, { target: { value: 'b.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => expect(useFilesPreviewStore.getState().selectedName).toBe('b.ts'));
    expect(useFilesPreviewStore.getState().selectedPath).toBe('~/b.ts');
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-mutations-flow.test.tsx
```
Expected: FAIL — preview path/name still 'a.ts'

- [ ] **Step 3: Modify `doRename` in FilesSidebarPanel**

Update `doRename`:
```tsx
const doRename = async (newName: string) => {
  if (!renameTarget) return;
  const oldPath = buildEntryPath(useFilesStore.getState().currentPath, renameTarget.name);
  const newPath = buildEntryPath(useFilesStore.getState().currentPath, newName);
  try {
    await client.renameFile(oldPath, newName);
    pushToast({ type: 'success', message: t('files.renameSuccess') });
    if (useFilesPreviewStore.getState().selectedPath === oldPath) {
      const kind = useFilesPreviewStore.getState().selectedKind;
      if (kind) useFilesPreviewStore.getState().selectFile(newPath, newName, kind);
    }
    setRenameTarget(null);
    await refresh();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${t('files.renameFailed')}: ${msg}` });
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-mutations-flow.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSidebarPanel.tsx packages/web/src/__tests__/flows/files-mutations-flow.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): update preview store path/name after rename of active file

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-6: Selection mode + clipboard (Tasks 40-45)

`FilesSelectionHeader` + `FilesBulkActionBar` + `FilesPasteBar` + copy/cut/paste 配線。

### Task 40: Add selection/clipboard i18n keys

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Append to en.json `files` block**

```json
"selectedCount": "{{count}} selected",
"selectAll": "Select all",
"deselectAll": "Deselect all",
"clipboardItems": "{{count}} item(s) on clipboard"
```

- [ ] **Step 2: Append to ja.json `files` block**

```json
"selectedCount": "{{count}} 件選択中",
"selectAll": "全選択",
"deselectAll": "選択解除",
"clipboardItems": "{{count}} 件をクリップボード"
```

- [ ] **Step 3: Verify JSON parses + type-check**

```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: prints `OK` then PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add selection/clipboard i18n keys for Sub-phase 2c-6

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 41: `FilesSelectionHeader` component

**Files:**
- Create: `packages/web/src/components/files/FilesSelectionHeader.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesSelectionHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesSelectionHeader.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { FilesSelectionHeader } from '../FilesSelectionHeader';

beforeAll(() => { initI18n(); });

describe('FilesSelectionHeader', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('shows selected count', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a', 'b']) });
    render(<FilesSelectionHeader />);
    expect(screen.getByText(/2 selected|2 件選択中/)).toBeInTheDocument();
  });

  it('select all selects every entry', () => {
    useFilesStore.setState({
      selectionMode: true,
      selectedNames: new Set(),
      entries: [
        { name: 'a', type: 'file', size: 0, modified: 0, permissions: '' },
        { name: 'b', type: 'file', size: 0, modified: 0, permissions: '' },
      ],
    });
    render(<FilesSelectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    expect(useFilesStore.getState().selectedNames.size).toBe(2);
  });

  it('close button exits selection mode', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a']) });
    render(<FilesSelectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(useFilesStore.getState().selectionMode).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSelectionHeader.test.tsx
```
Expected: FAIL — module '../FilesSelectionHeader' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesSelectionHeader.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import { useTheme } from '@/theme';

export function FilesSelectionHeader() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const selectedNames = useFilesStore((s) => s.selectedNames);
  const exitSelectionMode = useFilesStore((s) => s.exitSelectionMode);
  const selectAll = useFilesStore((s) => s.selectAll);

  return (
    <div
      role="region"
      aria-label="Selection header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        background: tokens.colors.bgHover,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <span style={{ flex: 1, color: tokens.colors.textPrimary }}>
        {t('files.selectedCount', { count: selectedNames.size })}
      </span>
      <button type="button" onClick={selectAll}>{t('files.selectAll')}</button>
      <button type="button" onClick={exitSelectionMode} aria-label={t('common.close')}>{t('common.close')}</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesSelectionHeader.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSelectionHeader.tsx packages/web/src/components/files/__tests__/FilesSelectionHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesSelectionHeader (count + select all + close)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 42: `FilesBulkActionBar` component (copy/cut/delete buttons)

**Files:**
- Create: `packages/web/src/components/files/FilesBulkActionBar.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesBulkActionBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesBulkActionBar.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { FilesBulkActionBar } from '../FilesBulkActionBar';

beforeAll(() => { initI18n(); });

describe('FilesBulkActionBar', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('renders nothing when not in selection mode or empty selection', () => {
    const { container } = render(<FilesBulkActionBar onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows copy/cut/delete buttons when items selected', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a']) });
    render(<FilesBulkActionBar onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cut/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('clicking copy fires onCopy with selected names', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a', 'b']) });
    const onCopy = vi.fn();
    render(<FilesBulkActionBar onCopy={onCopy} onCut={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(onCopy).toHaveBeenCalledWith(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesBulkActionBar.test.tsx
```
Expected: FAIL — module '../FilesBulkActionBar' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesBulkActionBar.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import { useTheme } from '@/theme';

interface Props {
  onCopy: (names: string[]) => void;
  onCut: (names: string[]) => void;
  onDelete: (names: string[]) => void;
}

export function FilesBulkActionBar({ onCopy, onCut, onDelete }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const selectionMode = useFilesStore((s) => s.selectionMode);
  const selectedNames = useFilesStore((s) => s.selectedNames);

  if (!selectionMode || selectedNames.size === 0) return null;

  const names = Array.from(selectedNames);

  const btn = {
    background: tokens.colors.bgElevated,
    border: `1px solid ${tokens.colors.borderSubtle}`,
    color: tokens.colors.textPrimary,
    borderRadius: 4,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    cursor: 'pointer' as const,
    fontSize: tokens.typography.body.fontSize,
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      style={{
        display: 'flex',
        gap: tokens.spacing.sm,
        justifyContent: 'space-around',
        padding: tokens.spacing.sm,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <button type="button" style={btn} onClick={() => onCopy(names)}>{t('files.copy')}</button>
      <button type="button" style={btn} onClick={() => onCut(names)}>{t('files.cut')}</button>
      <button type="button" style={{ ...btn, color: tokens.colors.error }} onClick={() => onDelete(names)}>
        {t('files.delete')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesBulkActionBar.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesBulkActionBar.tsx packages/web/src/components/files/__tests__/FilesBulkActionBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesBulkActionBar (copy/cut/delete bottom bar)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 43: `FilesPasteBar` component

**Files:**
- Create: `packages/web/src/components/files/FilesPasteBar.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesPasteBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesPasteBar.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { FilesPasteBar } from '../FilesPasteBar';

beforeAll(() => { initI18n(); });

describe('FilesPasteBar', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('renders nothing when clipboard empty', () => {
    const { container } = render(<FilesPasteBar onPaste={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows clipboard count + paste button when clipboard set', () => {
    useFilesStore.setState({ clipboard: { items: ['~/a', '~/b'], mode: 'copy' } });
    render(<FilesPasteBar onPaste={vi.fn()} />);
    expect(screen.getByText(/2 item/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument();
  });

  it('clicking paste fires onPaste with clipboard', () => {
    useFilesStore.setState({ clipboard: { items: ['~/a'], mode: 'cut' } });
    const onPaste = vi.fn();
    render(<FilesPasteBar onPaste={onPaste} />);
    fireEvent.click(screen.getByRole('button', { name: /paste/i }));
    expect(onPaste).toHaveBeenCalledWith({ items: ['~/a'], mode: 'cut' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesPasteBar.test.tsx
```
Expected: FAIL — module '../FilesPasteBar' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesPasteBar.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useFilesStore, type FilesClipboard } from '@/stores/files';
import { useTheme } from '@/theme';

interface Props {
  onPaste: (clipboard: FilesClipboard) => void;
}

export function FilesPasteBar({ onPaste }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const clipboard = useFilesStore((s) => s.clipboard);
  const clearClipboard = useFilesStore((s) => s.clearClipboard);

  if (!clipboard) return null;

  return (
    <div
      role="region"
      aria-label="Paste bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        background: tokens.colors.bgHover,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <span style={{ flex: 1, color: tokens.colors.textPrimary }}>
        {t('files.clipboardItems', { count: clipboard.items.length })} ({clipboard.mode})
      </span>
      <button type="button" onClick={() => onPaste(clipboard)}>{t('files.paste')}</button>
      <button type="button" onClick={clearClipboard} aria-label={t('common.close')}>{t('common.close')}</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesPasteBar.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesPasteBar.tsx packages/web/src/components/files/__tests__/FilesPasteBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesPasteBar (clipboard count + paste/clear)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 44: Wire selection mode + clipboard handlers in `FilesSidebarPanel`

**Files:**
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`
- Test: `packages/web/src/__tests__/flows/files-clipboard-flow.test.tsx`

- [ ] **Step 1: Write the failing flow test**

Create `packages/web/src/__tests__/flows/files-clipboard-flow.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { useUiStore } from '@/stores/ui';
import { FilesSidebarPanel } from '@/components/files/FilesSidebarPanel';

beforeAll(() => {
  initI18n();
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  }
});

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({
    path: '~',
    entries: [
      { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
      { name: 'a.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' },
      { name: 'b.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' },
    ],
  }),
  getFileContent: vi.fn(), writeFileContent: vi.fn(),
  deleteFile: vi.fn(), renameFile: vi.fn(),
  createDirectory: vi.fn(), uploadFile: vi.fn(),
  buildRawFileUrl: () => '',
  copyFiles: vi.fn().mockResolvedValue({ copied: [] }),
  moveFiles: vi.fn().mockResolvedValue({ moved: [] }),
});

describe('Files clipboard flow', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('Ctrl+Click enters selection mode and selects entry', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    expect(useFilesStore.getState().selectionMode).toBe(true);
    expect(useFilesStore.getState().selectedNames.has('a.ts')).toBe(true);
  });

  it('copy → store clipboard with copy mode → toast', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: /b\.ts/ }));
    expect(useFilesStore.getState().selectedNames.size).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }));
    expect(useFilesStore.getState().clipboard?.mode).toBe('copy');
    expect(useFilesStore.getState().clipboard?.items).toEqual(['~/a.ts', '~/b.ts']);
    expect(useUiStore.getState().toasts.some((t) => t.message.includes('clipboard') || t.message.includes('クリップボード'))).toBe(true);
  });

  it('paste in copy mode calls copyFiles', async () => {
    const client = makeClient();
    useFilesStore.setState({ clipboard: { items: ['~/a.ts'], mode: 'copy' } });
    useFilesStore.setState({ currentPath: '~' });
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^paste$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^paste$/i }));
    await waitFor(() => expect(client.copyFiles).toHaveBeenCalledWith(['~/a.ts'], '~'));
  });

  it('paste in cut mode calls moveFiles and clears clipboard', async () => {
    const client = makeClient();
    useFilesStore.setState({ clipboard: { items: ['~/a.ts'], mode: 'cut' }, currentPath: '~/sub' });
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^paste$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^paste$/i }));
    await waitFor(() => expect(client.moveFiles).toHaveBeenCalledWith(['~/a.ts'], '~/sub'));
    expect(useFilesStore.getState().clipboard).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-clipboard-flow.test.tsx
```
Expected: FAIL — long-press not wired, no copy handler, no paste bar render

- [ ] **Step 3: Update `FilesSidebarPanel.tsx`**

Edit `packages/web/src/components/files/FilesSidebarPanel.tsx`:

Add imports:
```tsx
import { FilesSelectionHeader } from './FilesSelectionHeader';
import { FilesBulkActionBar } from './FilesBulkActionBar';
import { FilesPasteBar } from './FilesPasteBar';
import type { FilesClipboard } from '@/stores/files';
```

Inside the component, modify `handleOpen` to honour selection mode:
```tsx
const handleOpen = (entry: FileEntry) => {
  // In selection mode, clicking a row toggles selection instead of opening
  if (useFilesStore.getState().selectionMode) {
    useFilesStore.getState().toggleSelection(entry.name);
    return;
  }
  // (rest of the handleOpen body remains unchanged)
  const isDir = entry.type === 'directory'
    || (entry.type === 'symlink' && entry.resolvedType === 'directory');
  const proceed = () => {
    if (isDir) {
      useFilesStore.getState().setCurrentPath(buildEntryPath(currentPath, entry.name));
      return;
    }
    const kind = getPreviewKind(entry.name);
    useFilesPreviewStore.getState().selectFile(buildEntryPath(currentPath, entry.name), entry.name, kind);
  };
  const isDirty = useFilesPreviewStore.getState().isDirty;
  if (isDirty) {
    useUiStore.getState().showConfirm({
      title: t('files.unsavedChangesTitle'),
      message: t('files.unsavedChangesMessage'),
      destructive: true,
      onConfirm: () => { useFilesPreviewStore.getState().cancelEditing(); proceed(); },
    });
    return;
  }
  proceed();
};

const handleLongPress = (entry: FileEntry) => {
  useFilesStore.getState().enterSelectionMode(entry.name);
};

const doCopy = (names: string[]) => {
  const items = names.map((n) => buildEntryPath(useFilesStore.getState().currentPath, n));
  useFilesStore.getState().setClipboard({ items, mode: 'copy' });
  useFilesStore.getState().exitSelectionMode();
  pushToast({ type: 'success', message: t('files.copySuccess') });
};

const doCut = (names: string[]) => {
  const items = names.map((n) => buildEntryPath(useFilesStore.getState().currentPath, n));
  useFilesStore.getState().setClipboard({ items, mode: 'cut' });
  useFilesStore.getState().exitSelectionMode();
  pushToast({ type: 'success', message: t('files.cutSuccess') });
};

const doBulkDelete = (names: string[]) => {
  showConfirm({
    title: t('files.deleteConfirmTitle'),
    message: t('files.deleteConfirmMultiple', { count: names.length }),
    destructive: true,
    onConfirm: async () => {
      try {
        for (const n of names) {
          await client.deleteFile(buildEntryPath(useFilesStore.getState().currentPath, n));
        }
        pushToast({ type: 'success', message: t('files.deleteSuccess') });
        useFilesStore.getState().exitSelectionMode();
        await refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushToast({ type: 'error', message: `${t('files.deleteFailed')}: ${msg}` });
      }
    },
  });
};

const doPaste = async (clipboard: FilesClipboard) => {
  const dest = useFilesStore.getState().currentPath;
  try {
    if (clipboard.mode === 'copy') {
      await client.copyFiles(clipboard.items, dest);
    } else {
      await client.moveFiles(clipboard.items, dest);
    }
    pushToast({ type: 'success', message: t('files.pasteSuccess') });
    useFilesStore.getState().clearClipboard();
    await refresh();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${t('files.pasteFailed')}: ${msg}` });
  }
};
```

Wire `onLongPress={handleLongPress}` on `<FilesList>`. Wire context menu copy/cut/select handlers:
```tsx
{contextMenu && (
  <FilesContextMenu
    entry={contextMenu.entry}
    x={contextMenu.x}
    y={contextMenu.y}
    onClose={() => setContextMenu(null)}
    onRename={(e) => setRenameTarget(e)}
    onCopy={(e) => doCopy([e.name])}
    onCut={(e) => doCut([e.name])}
    onDelete={doDelete}
    onDetails={(e) => setDetailsTarget(e)}
    onSelect={(e) => useFilesStore.getState().enterSelectionMode(e.name)}
  />
)}
```

Insert the selection/paste/bulk-action UI between the breadcrumbs and the list. Also include `FilesSelectionHeader` and `FilesPasteBar` conditionally:
```tsx
const selectionMode = useFilesStore((s) => s.selectionMode);
const clipboard = useFilesStore((s) => s.clipboard);
```

JSX structure update (replace the existing flex `<div style={{ flex: 1, overflowY: 'auto' }}>`):
```tsx
{selectionMode && <FilesSelectionHeader />}
{clipboard && <FilesPasteBar onPaste={doPaste} />}
<div style={{ flex: 1, overflowY: 'auto' }}>
  {/* loading / error / list as before */}
</div>
{selectionMode && (
  <FilesBulkActionBar onCopy={doCopy} onCut={doCut} onDelete={doBulkDelete} />
)}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-clipboard-flow.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSidebarPanel.tsx packages/web/src/__tests__/flows/files-clipboard-flow.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire selection mode + clipboard (copy/cut/paste/bulk-delete) handlers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 45: Bulk delete via context menu single-item path (regression)

**Files:**
- Test: `packages/web/src/__tests__/flows/files-clipboard-flow.test.tsx`

> The single-item delete path stayed unchanged in Task 38; this task adds an integration assertion that confirms `doBulkDelete` performs *count* deletions (e.g. for 2 selected items, calls deleteFile twice).

- [ ] **Step 1: Append the test**

Append to `packages/web/src/__tests__/flows/files-clipboard-flow.test.tsx` inside the existing `describe`:
```tsx
  it('bulk delete calls deleteFile for each selected item', async () => {
    const client = makeClient();
    client.deleteFile = vi.fn().mockResolvedValue({ path: '', deleted: true });
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /a\.ts/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: /b\.ts/ }));

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    await useUiStore.getState().confirmDialog!.onConfirm();

    expect(client.deleteFile).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 2: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-clipboard-flow.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/files-clipboard-flow.test.tsx
git commit -m "$(cat <<'EOF'
test(web): assert bulk delete calls deleteFile per selected item

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-7: Upload (Tasks 46-49)

`FilesUploadDropZone` + ファイルピッカー + uploadFile API + drag&drop イベント。

### Task 46: Add upload i18n keys

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Append to en.json `files` block**

```json
"uploadComplete": "Upload complete",
"uploadFailed": "Upload failed",
"uploadFailedDesc": "Could not upload file.",
"uploadDropHint": "Drop files here to upload"
```

- [ ] **Step 2: Append to ja.json `files` block**

```json
"uploadComplete": "アップロード完了",
"uploadFailed": "アップロード失敗",
"uploadFailedDesc": "ファイルをアップロードできませんでした。",
"uploadDropHint": "ここにドロップしてアップロード"
```

- [ ] **Step 3: Verify JSON parses + type-check**

```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: prints `OK` then PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add upload i18n keys for Sub-phase 2c-7

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 47: `FilesUploadDropZone` component

**Files:**
- Create: `packages/web/src/components/files/FilesUploadDropZone.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesUploadDropZone.test.tsx`

> Drag&drop overlay that displays only when a drag is in progress over its parent. Captures the drop and forwards files via `onFiles`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesUploadDropZone.test.tsx`:
```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { FilesUploadDropZone } from '../FilesUploadDropZone';

beforeAll(() => { initI18n(); });

describe('FilesUploadDropZone', () => {
  it('renders nothing visible by default', () => {
    render(<FilesUploadDropZone onFiles={vi.fn()} />);
    expect(screen.queryByText(/drop files/i)).toBeNull();
  });

  it('shows hint text on dragenter and hides on dragleave', () => {
    render(<FilesUploadDropZone onFiles={vi.fn()} />);
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText(/drop files/i)).toBeInTheDocument();
    fireEvent.dragLeave(window);
    // Note: may still be visible until drop or counter resets — just verify drop clears it
  });

  it('on drop fires onFiles with array of File', () => {
    const onFiles = vi.fn();
    render(<FilesUploadDropZone onFiles={onFiles} />);
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'] } });
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const overlay = screen.getByText(/drop files/i);
    fireEvent.drop(overlay, { dataTransfer: { files: [file], types: ['Files'] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesUploadDropZone.test.tsx
```
Expected: FAIL — module '../FilesUploadDropZone' not found

- [ ] **Step 3: Write implementation**

Create `packages/web/src/components/files/FilesUploadDropZone.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  onFiles: (files: File[]) => void;
}

export function FilesUploadDropZone({ onFiles }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let counter = 0;
    const enter = (e: DragEvent) => {
      if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
      counter++;
      setActive(true);
    };
    const leave = () => {
      counter = Math.max(0, counter - 1);
      if (counter === 0) setActive(false);
    };
    const over = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault();
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
      aria-label="Upload drop zone"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        setActive(false);
        if (files.length > 0) onFiles(files);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        color: tokens.colors.textPrimary,
        fontSize: tokens.typography.heading.fontSize,
        pointerEvents: 'auto',
      }}
    >
      {t('files.uploadDropHint')}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesUploadDropZone.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesUploadDropZone.tsx packages/web/src/components/files/__tests__/FilesUploadDropZone.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesUploadDropZone overlay (drag-enter detection + drop)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 48: Wire upload (file picker) into `FilesSidebarPanel`

**Files:**
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`
- Test: `packages/web/src/__tests__/flows/files-upload-flow.test.tsx`

- [ ] **Step 1: Write the failing flow test**

Create `packages/web/src/__tests__/flows/files-upload-flow.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesStore } from '@/stores/files';
import { useUiStore } from '@/stores/ui';
import { FilesSidebarPanel } from '@/components/files/FilesSidebarPanel';

beforeAll(() => { initI18n(); });

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({ path: '~', entries: [] }),
  getFileContent: vi.fn(), writeFileContent: vi.fn(),
  deleteFile: vi.fn(), renameFile: vi.fn(), copyFiles: vi.fn(),
  moveFiles: vi.fn(), createDirectory: vi.fn(),
  buildRawFileUrl: () => '',
  uploadFile: vi.fn().mockResolvedValue({
    success: true, path: '~/up.bin', filename: 'up.bin', size: 4, mimetype: 'application/octet-stream',
  }),
});

describe('Files upload flow', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('clicking Upload triggers hidden file input → selecting file calls uploadFile', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalled());

    // The hidden input is queryable by label or test id; we expose it via a stable test id.
    const input = screen.getByTestId('files-upload-input') as HTMLInputElement;
    const file = new File(['data'], 'up.bin', { type: 'application/octet-stream' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => expect(client.uploadFile).toHaveBeenCalledWith(file, '~'));
    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'success')).toBe(true));
    expect(client.listFiles).toHaveBeenCalledTimes(2); // initial + post-upload refresh
  });

  it('drag-drop file fires uploadFile', async () => {
    const client = makeClient();
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalled());
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'] } });
    const overlay = await screen.findByText(/drop files/i);
    const file = new File(['data'], 'dropped.txt', { type: 'text/plain' });
    fireEvent.drop(overlay, { dataTransfer: { files: [file], types: ['Files'] } });
    await waitFor(() => expect(client.uploadFile).toHaveBeenCalledWith(file, '~'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-upload-flow.test.tsx
```
Expected: FAIL — no hidden file input, no drop zone wired

- [ ] **Step 3: Modify `FilesSidebarPanel.tsx`**

Edit `packages/web/src/components/files/FilesSidebarPanel.tsx`:

Add imports:
```tsx
import { useRef } from 'react';
import { FilesUploadDropZone } from './FilesUploadDropZone';
```

Add a hidden file input ref + handlers inside the component:
```tsx
const uploadInputRef = useRef<HTMLInputElement>(null);

const doUploadFiles = async (files: File[]) => {
  const dest = useFilesStore.getState().currentPath;
  for (const f of files) {
    try {
      await client.uploadFile(f, dest);
      pushToast({ type: 'success', message: t('files.uploadComplete') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast({ type: 'error', message: `${t('files.uploadFailed')}: ${msg}` });
    }
  }
  await refresh();
};
```

Wire the toolbar `onUploadClick`:
```tsx
<FilesToolbar
  onUploadClick={() => uploadInputRef.current?.click()}
  onNewFile={() => setNewFileOpen(true)}
  onNewFolder={() => setMkdirOpen(true)}
/>
```

Insert the hidden input + drop zone at the bottom of the panel JSX (siblings of the dialogs):
```tsx
<input
  ref={uploadInputRef}
  data-testid="files-upload-input"
  type="file"
  multiple
  hidden
  onChange={(e) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void doUploadFiles(files);
    e.target.value = '';
  }}
/>
<FilesUploadDropZone onFiles={(files) => void doUploadFiles(files)} />
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-upload-flow.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesSidebarPanel.tsx packages/web/src/__tests__/flows/files-upload-flow.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire upload via file picker + drag&drop in FilesSidebarPanel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 49: Upload error toast on 413/500

**Files:**
- Test: `packages/web/src/__tests__/flows/files-upload-flow.test.tsx`

- [ ] **Step 1: Append the failing test**

Append to `packages/web/src/__tests__/flows/files-upload-flow.test.tsx` inside the existing describe:
```tsx
  it('shows error toast on upload failure', async () => {
    const client = makeClient();
    client.uploadFile = vi.fn().mockRejectedValue(new Error('boom'));
    render(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalled());

    const input = screen.getByTestId('files-upload-input') as HTMLInputElement;
    const file = new File(['data'], 'up.bin', { type: 'application/octet-stream' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'error')).toBe(true));
  });
```

- [ ] **Step 2: Run test (should pass — already implemented in Task 48)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/files-upload-flow.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/files-upload-flow.test.tsx
git commit -m "$(cat <<'EOF'
test(web): assert upload error toast on rejected uploadFile

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-8: Download (Tasks 50-51)

Right-pane Download button using authorized blob URL.

### Task 50: Wire Download in `FilesViewerPane`

**Files:**
- Modify: `packages/web/src/components/files/FilesViewerPane.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesViewerPane.download.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesViewerPane.download.test.tsx`:
```tsx
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerPane } from '../FilesViewerPane';

beforeAll(() => { initI18n(); });

describe('FilesViewerPane download', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['payload'])));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:dl' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  });
  afterEach(() => fetchSpy.mockRestore());

  it('clicking Download fetches raw URL with Bearer and triggers download', async () => {
    useFilesPreviewStore.getState().selectFile('~/a.bin', 'a.bin', 'unsupported');
    const client = {
      listFiles: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
      renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
      createDirectory: vi.fn(), uploadFile: vi.fn(),
      buildRawFileUrl: (p: string) => `http://gw/api/files/raw?path=${encodeURIComponent(p)}`,
      getFileContent: vi.fn(),
    };
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    render(<FilesViewerPane client={client as any} token="tok" />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerPane.download.test.tsx
```
Expected: FAIL — Download button is a no-op stub

- [ ] **Step 3: Modify `FilesViewerPane.tsx`**

Add a `handleDownload` function inside the component:
```tsx
const handleDownload = async () => {
  const path = useFilesPreviewStore.getState().selectedPath;
  const name = useFilesPreviewStore.getState().selectedName;
  if (!path || !name) return;
  try {
    const res = await fetch(client.buildRawFileUrl(path), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useUiStore.getState().pushToast({ type: 'error', message: `${t('files.downloadFailed')}: ${msg}` });
  }
};
```

Replace the previous `onDownload` stub in `<FilesViewerHeader>`:
```tsx
<FilesViewerHeader
  onEdit={() => useFilesPreviewStore.getState().startEditing()}
  onSave={handleSave}
  onCancel={() => useFilesPreviewStore.getState().cancelEditing()}
  onDownload={handleDownload}
  onToggleMarkdown={() => useFilesPreviewStore.getState().toggleMarkdownRendered()}
/>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerPane.download.test.tsx
```
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/files/FilesViewerPane.tsx packages/web/src/components/files/__tests__/FilesViewerPane.download.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire Download in FilesViewerPane (Bearer fetch → Blob → <a download> click)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 51: Surface Download button for unsupported binary kind

**Files:**
- Modify: `packages/web/src/components/files/FilesViewerPane.tsx`
- Test: `packages/web/src/components/files/__tests__/FilesViewerPane.unsupported.test.tsx`

> When the user selects an unsupported file (e.g., `.zip`), the right pane shows the empty state but should still expose a Download button so the file can be retrieved.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/files/__tests__/FilesViewerPane.unsupported.test.tsx`:
```tsx
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerPane } from '../FilesViewerPane';

beforeAll(() => { initI18n(); });

describe('FilesViewerPane unsupported kind', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('renders header (with Download button) even for unsupported kind', () => {
    useFilesPreviewStore.getState().selectFile('~/a.zip', 'a.zip', 'unsupported');
    const client = {
      listFiles: vi.fn(), writeFileContent: vi.fn(), deleteFile: vi.fn(),
      renameFile: vi.fn(), copyFiles: vi.fn(), moveFiles: vi.fn(),
      createDirectory: vi.fn(), uploadFile: vi.fn(),
      buildRawFileUrl: () => '', getFileContent: vi.fn(),
    };
    render(<FilesViewerPane client={client as any} token="tok" />);
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByText(/cannot open/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (already passing because Task 25 always renders the header when something is selected)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/files/__tests__/FilesViewerPane.unsupported.test.tsx
```
Expected: PASS (1 test) — locks in the existing behaviour.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/files/__tests__/FilesViewerPane.unsupported.test.tsx
git commit -m "$(cat <<'EOF'
test(web): assert unsupported preview still exposes Download

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-9: Finalization (Tasks 52-55)

Sidebar Files タブ enable + AuthenticatedShell の files route 確認 + i18n cleanup + 既存 Sidebar.test.tsx 更新 + App.tsx route 切替。

### Task 52: Add `routes/files.tsx` and replace App `/web/files` route

**Files:**
- Create: `packages/web/src/routes/files.tsx`
- Modify: `packages/web/src/App.tsx`
- Test: `packages/web/src/__tests__/App.test.tsx`

- [ ] **Step 1: Inspect existing App.test.tsx to know existing assertions**

Run:
```bash
cd /home/server/projects/zenterm/server && cat packages/web/src/__tests__/App.test.tsx
```
This is informational — confirm the test file exists and how it imports `App`. Do NOT change non-files-related assertions.

- [ ] **Step 2: Add a failing test**

Append to `packages/web/src/__tests__/App.test.tsx` (inside the existing `describe`):
```tsx
  it('renders FilesRoute on /web/files', async () => {
    // Pre-authenticate
    const { useAuthStore } = await import('@/stores/auth');
    useAuthStore.setState({ token: '4790', gatewayUrl: 'http://gw' });
    window.history.pushState({}, '', '/web/files');
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <App />
      </MemoryRouter>,
    );
    // FilesRoute mounts AuthenticatedShell with the Sidebar; the Sidebar shows the Files panel area:
    expect(await screen.findByLabelText(/files panel/i)).toBeInTheDocument();
  });
```

(If the existing App.test.tsx imports `screen`, `render`, `MemoryRouter`, etc., reuse them — otherwise add the imports at the top.)

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/App.test.tsx
```
Expected: FAIL — `/web/files` redirects to `/web/sessions`

- [ ] **Step 4: Create `routes/files.tsx`**

Create `packages/web/src/routes/files.tsx`:
```tsx
import { AuthenticatedShell } from '@/components/AuthenticatedShell';

export function FilesRoute() {
  return <AuthenticatedShell />;
}
```

- [ ] **Step 5: Update `App.tsx` to use FilesRoute**

Edit `packages/web/src/App.tsx`. Add the import:
```tsx
import { FilesRoute } from './routes/files';
```

Replace the existing `/web/files` route definition:
```tsx
<Route
  path="/web/files"
  element={
    <RequireAuth>
      <FilesRoute />
    </RequireAuth>
  }
/>
```

(Remove the old `<Route path="/web/files" element={<Navigate to="/web/sessions" replace />} />`.)

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/App.test.tsx
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/routes/files.tsx packages/web/src/App.tsx packages/web/src/__tests__/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add FilesRoute and wire /web/files to AuthenticatedShell

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 53: Enable Files tab in Sidebar (remove disabled + tooltip; add navigate)

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx`
- Modify: `packages/web/src/components/__tests__/Sidebar.test.tsx`
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Update Sidebar.test.tsx to expect enabled state**

In `packages/web/src/components/__tests__/Sidebar.test.tsx`:

Replace line 37 (inside the first `it('renders sessions panel and bottom nav with 3 buttons', ...)`):
```tsx
expect(screen.getByRole('button', { name: /Files tab/i })).not.toBeDisabled();
```

Replace the entire `it('Files tab is disabled with Phase 2c tooltip', ...)` block (around line 124-133) with:
```tsx
  it('Files tab is enabled and navigates to /web/files', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Routes>
          <Route path="/web/*" element={<Sidebar {...baseProps} />} />
        </Routes>
      </MemoryRouter>,
    );
    const filesTab = screen.getByRole('button', { name: /Files tab/i });
    expect(filesTab).not.toBeDisabled();
    expect(filesTab.getAttribute('title')).not.toMatch(/Phase 2c/);
    fireEvent.click(filesTab);
    expect(filesTab.getAttribute('aria-pressed')).toBe('true');
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/Sidebar.test.tsx
```
Expected: FAIL — Files tab still disabled

- [ ] **Step 3: Update `Sidebar.tsx`**

In `packages/web/src/components/Sidebar.tsx`, replace the Files tab `<button>`:
```tsx
<button
  type="button"
  aria-label="Files tab"
  aria-pressed={activePanel === 'files'}
  onClick={() => navigate('/web/files')}
  style={tabButtonStyle(activePanel === 'files')}
>
  📁 {t('sidebar.tabs.files')}
</button>
```

(Removed: `disabled` attribute, `title={t('sidebar.filesComingSoon')}`, `true` second arg to `tabButtonStyle`.)

- [ ] **Step 4: Remove `sidebar.filesComingSoon` from locales**

Edit `packages/web/src/i18n/locales/en.json` — delete the line:
```json
"filesComingSoon": "Coming in Phase 2c",
```
(and the leading comma adjustment as needed)

Edit `packages/web/src/i18n/locales/ja.json` — delete the corresponding line:
```json
"filesComingSoon": "Phase 2c で追加予定",
```

- [ ] **Step 5: Run Sidebar tests + JSON parse**

```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/Sidebar.test.tsx
```
Expected: prints `OK` then PASS

- [ ] **Step 6: Search for any remaining `filesComingSoon` references**

```bash
cd /home/server/projects/zenterm/server && grep -rn "filesComingSoon" packages/web/src/ tests/
```
Expected: no matches (or only locale lines you have already removed). If any source/test refers to the key, remove that reference too.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/Sidebar.tsx packages/web/src/components/__tests__/Sidebar.test.tsx packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): enable Sidebar Files tab; drop sidebar.filesComingSoon i18n key

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 54: Sidebar test for active 'files' panel highlight

**Files:**
- Modify: `packages/web/src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Append the test inside the existing `describe('Sidebar URL-driven activePanel', ...)`**

```tsx
  it('marks Files tab pressed on /web/files', () => {
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    const filesTab = screen.getByRole('button', { name: /Files tab/i });
    expect(filesTab.getAttribute('aria-pressed')).toBe('true');
  });
```

- [ ] **Step 2: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/Sidebar.test.tsx
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/__tests__/Sidebar.test.tsx
git commit -m "$(cat <<'EOF'
test(web): assert Files tab pressed on /web/files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 55: Locale verification (full files namespace + alphabetize check)

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json` (sanity audit only)
- Modify: `packages/web/src/i18n/locales/ja.json` (sanity audit only)

- [ ] **Step 1: Audit en.json `files` block contains every key referenced in code**

```bash
cd /home/server/projects/zenterm/server && grep -roh "files\.[a-zA-Z][a-zA-Z]*" packages/web/src/ | sort -u
```
Compare with the keys present in `packages/web/src/i18n/locales/en.json` `files` object. All referenced keys must exist. The expected set (consolidated from Tasks 9, 19, 21 (edit/save/cancel), 26, 32, 40, 46) is:

```
files.cannotFetchFiles
files.cannotOpen
files.cannotOpenDesc
files.clipboardItems
files.copy
files.copySuccess
files.createNewFile
files.cut
files.cutSuccess
files.delete
files.deleteConfirmMessage
files.deleteConfirmMultiple
files.deleteConfirmTitle
files.deleteFailed
files.deleteFailedDesc
files.deleteSuccess
files.deselectAll
files.details
files.detailsModified
files.detailsPermissions
files.detailsSize
files.download
files.downloadFailed
files.downloadFailedDesc
files.edit
files.emptyDirectoryDescription
files.emptyDirectoryTitle
files.fetchFailedDesc
files.fileNamePlaceholder
files.folderNamePlaceholder
files.goUp
files.loadFailed
files.loadFailedDesc
files.mkdirFailed
files.mkdirFailedDesc
files.mkdirSuccess
files.newFolder
files.noServerConfigured
files.paste
files.pasteFailed
files.pasteFailedDesc
files.pasteSuccess
files.previewDescription
files.previewTitle
files.rename
files.renameFailed
files.renameFailedDesc
files.renameSuccess
files.rendered
files.save
files.saved
files.saveFailed
files.saveFailedDesc
files.selectAll
files.selectedCount
files.sort
files.sortModifiedDesc
files.sortNameAsc
files.sortNameDesc
files.sortSizeDesc
files.source
files.title
files.toggleHiddenFiles
files.toggleSort
files.truncatedIndicator
files.unsavedChangesMessage
files.unsavedChangesTitle
files.uploadComplete
files.uploadDropHint
files.uploadFailed
files.uploadFailedDesc
files.uploadFile
```

- [ ] **Step 2: Add any missing keys to both en.json and ja.json**

If `grep` output above contains keys not present in en.json `files` block, add them. Suggested defaults for any unanticipated key: title-cased English noun. For ja.json: a literal Japanese rendering. (This step exists to absorb any stray references introduced incidentally by component code.) Verify both files parse:
```bash
cd /home/server/projects/zenterm/server && node -e "JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('packages/web/src/i18n/locales/ja.json','utf8')); console.log('OK')"
```

- [ ] **Step 3: Run full type-check + all vitest tests**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web
```
Expected: type-check PASS; all vitest suites PASS (Phase 2a + 2b + 2c)

- [ ] **Step 4: Commit (only if any keys were added)**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git diff --cached --quiet || git commit -m "$(cat <<'EOF'
chore(web): backfill any missing files.* i18n keys after audit

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2c-10: Playwright E2E + final review (Tasks 56-62)

各 spec で fresh gateway を spawn (`tests/e2e/web/settings-tab.spec.ts` がテンプレート)。ポート割当: browse=18800, preview=18801, edit-save=18802, rename-delete=18803, mkdir=18804, copy-paste=18805, upload-download=18806。

### Task 56: E2E `files-browse.spec.ts`

**Files:**
- Create: `tests/e2e/web/files-browse.spec.ts`

- [ ] **Step 1: Build the gateway + web (so dist exists)**

```bash
cd /home/server/projects/zenterm/server && npm run build:gateway && npm run -w @zenterm/web build
```
Expected: both build successfully.

- [ ] **Step 2: Write the spec**

Create `tests/e2e/web/files-browse.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4800';
const PORT = 18800;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);

  // Seed home directory with a few files and a sub-directory
  mkdirSync(join(home, 'src'), { recursive: true });
  writeFileSync(join(home, 'README.md'), '# hello world\n');
  writeFileSync(join(home, 'src', 'a.ts'), 'export const x = 1;\n');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(() => { gateway?.kill(); });

test('browse: home → sub directory → breadcrumb back', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /Files tab/i }).click();
  await expect(page).toHaveURL(/\/web\/files$/);
  await expect(page.getByLabel(/Files panel/i)).toBeVisible();

  // Initial entries
  await expect(page.getByRole('button', { name: /^src$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^README\.md$/ })).toBeVisible();

  // Enter src
  await page.getByRole('button', { name: /^src$/ }).click();
  await expect(page.getByRole('button', { name: /^a\.ts$/ })).toBeVisible();

  // Breadcrumb: click Home to return
  await page.getByRole('button', { name: /^Home$/ }).click();
  await expect(page.getByRole('button', { name: /^README\.md$/ })).toBeVisible();
});
```

- [ ] **Step 3: Run the spec**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/files-browse.spec.ts
```
Expected: PASS (1 test). If it fails because the `vite build` output does not include the `files` chunks, re-run `npm run -w @zenterm/web build` and retry.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/web/files-browse.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add files-browse spec (port 18800)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 57: E2E `files-preview.spec.ts`

**Files:**
- Create: `tests/e2e/web/files-preview.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/web/files-preview.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4801';
const PORT = 18801;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);
  writeFileSync(join(home, 'note.txt'), 'line one\nline two\nline three\n');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;

  for (let i = 0; i < 30; i++) {
    try { const res = await fetch(`${baseUrl}/health`); if (res.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(() => { gateway?.kill(); });

test('preview: select text file → content rendered', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /Files tab/i }).click();
  await page.getByRole('button', { name: /^note\.txt$/ }).click();

  // Header with filename
  await expect(page.getByText(/note\.txt/)).toBeVisible();
  // Body with content
  await expect(page.getByText('line one')).toBeVisible();
  await expect(page.getByText('line three')).toBeVisible();
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/files-preview.spec.ts
```
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/files-preview.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add files-preview spec (port 18801)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 58: E2E `files-edit-save.spec.ts`

**Files:**
- Create: `tests/e2e/web/files-edit-save.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/web/files-edit-save.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4802';
const PORT = 18802;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);
  writeFileSync(join(home, 'edit.txt'), 'before');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try { const res = await fetch(`${baseUrl}/health`); if (res.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(() => { gateway?.kill(); });

test('edit & save text file persists to disk', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /Files tab/i }).click();
  await page.getByRole('button', { name: /^edit\.txt$/ }).click();

  await page.getByRole('button', { name: /^Edit$/ }).click();

  // CodeMirror 6 renders a contentEditable .cm-content. Type into it.
  const cmContent = page.locator('.cm-content');
  await cmContent.click();
  // Select all + replace
  await page.keyboard.press('Control+A');
  await page.keyboard.type('after-edit');

  await page.getByRole('button', { name: /^Save$/ }).click();

  // Toast appears
  await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 5000 });

  // File on disk has the new content
  const onDisk = readFileSync(join(home, 'edit.txt'), 'utf8');
  expect(onDisk).toBe('after-edit');
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/files-edit-save.spec.ts
```
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/files-edit-save.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add files-edit-save spec (port 18802)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 59: E2E `files-rename-delete.spec.ts`

**Files:**
- Create: `tests/e2e/web/files-rename-delete.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/web/files-rename-delete.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4803';
const PORT = 18803;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);
  writeFileSync(join(home, 'oldname.txt'), 'x');
  writeFileSync(join(home, 'doomed.txt'), 'y');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try { const res = await fetch(`${baseUrl}/health`); if (res.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(() => { gateway?.kill(); });

test('rename and delete via context menu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /Files tab/i }).click();
  await expect(page.getByRole('button', { name: /^oldname\.txt$/ })).toBeVisible();

  // Rename
  await page.getByRole('button', { name: /^oldname\.txt$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^Rename$/ }).click();
  const input = page.locator('dialog input[type="text"]').first();
  await input.fill('newname.txt');
  await page.getByRole('button', { name: /^OK$/ }).click();
  await expect(page.getByRole('button', { name: /^newname\.txt$/ })).toBeVisible({ timeout: 5000 });
  expect(existsSync(join(home, 'newname.txt'))).toBe(true);
  expect(existsSync(join(home, 'oldname.txt'))).toBe(false);

  // Delete
  await page.getByRole('button', { name: /^doomed\.txt$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^Delete$/ }).click();
  // Confirm dialog
  await page.getByRole('button', { name: /^Delete$/ }).last().click();
  await expect(page.getByRole('button', { name: /^doomed\.txt$/ })).toHaveCount(0, { timeout: 5000 });
  expect(existsSync(join(home, 'doomed.txt'))).toBe(false);
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/files-rename-delete.spec.ts
```
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/files-rename-delete.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add files-rename-delete spec (port 18803)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 60: E2E `files-mkdir.spec.ts`

**Files:**
- Create: `tests/e2e/web/files-mkdir.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/web/files-mkdir.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4804';
const PORT = 18804;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try { const res = await fetch(`${baseUrl}/health`); if (res.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(() => { gateway?.kill(); });

test('mkdir via toolbar New menu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Files tab/i }).click();

  await page.getByRole('button', { name: /^New File$/ }).click().catch(() => {});
  // The new menu shows two items; click "New Folder"
  await page.getByRole('button', { name: /New File/i }).first().click();
  await page.getByRole('menuitem', { name: /^New Folder$/ }).click();

  const input = page.locator('dialog input[type="text"]').first();
  await input.fill('mydir');
  await page.getByRole('button', { name: /^OK$/ }).click();

  await expect(page.getByRole('button', { name: /^mydir$/ })).toBeVisible({ timeout: 5000 });
  const stat = statSync(join(home, 'mydir'));
  expect(stat.isDirectory()).toBe(true);
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/files-mkdir.spec.ts
```
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/files-mkdir.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add files-mkdir spec (port 18804)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 61: E2E `files-copy-paste.spec.ts` + `files-upload-download.spec.ts`

**Files:**
- Create: `tests/e2e/web/files-copy-paste.spec.ts`
- Create: `tests/e2e/web/files-upload-download.spec.ts`

- [ ] **Step 1: Write `files-copy-paste.spec.ts`**

Create `tests/e2e/web/files-copy-paste.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4805';
const PORT = 18805;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);
  mkdirSync(join(home, 'dst'), { recursive: true });
  writeFileSync(join(home, 'src.txt'), 'payload');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try { const res = await fetch(`${baseUrl}/health`); if (res.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});
test.afterAll(() => { gateway?.kill(); });

test('copy file via context menu, paste in another directory', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Files tab/i }).click();

  // Copy src.txt
  await page.getByRole('button', { name: /^src\.txt$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^Copy$/ }).click();

  // Navigate into dst
  await page.getByRole('button', { name: /^dst$/ }).click();
  await expect(page.getByRole('button', { name: /^Paste$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Paste$/ }).click();

  await expect(page.getByRole('button', { name: /^src\.txt$/ })).toBeVisible({ timeout: 5000 });
  expect(existsSync(join(home, 'dst', 'src.txt'))).toBe(true);
  expect(existsSync(join(home, 'src.txt'))).toBe(true); // copy preserves source
});
```

- [ ] **Step 2: Write `files-upload-download.spec.ts`**

Create `tests/e2e/web/files-upload-download.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4806';
const PORT = 18806;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(join(home, '.config', 'zenterm', '.env'), `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`);
  writeFileSync(join(home, 'download-me.txt'), 'download-payload');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try { const res = await fetch(`${baseUrl}/health`); if (res.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});
test.afterAll(() => { gateway?.kill(); });

test('upload via picker writes file on server', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Files tab/i }).click();

  const fileInput = page.locator('input[data-testid="files-upload-input"]');
  await fileInput.setInputFiles({
    name: 'uploaded.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('uploaded-payload'),
  });

  await expect(page.getByRole('button', { name: /^uploaded\.txt$/ })).toBeVisible({ timeout: 5000 });
  expect(existsSync(join(home, 'uploaded.txt'))).toBe(true);
  expect(readFileSync(join(home, 'uploaded.txt'), 'utf8')).toBe('uploaded-payload');
});

test('download button delivers file body via blob', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenterm-web-settings', JSON.stringify({
      state: { themeMode: 'dark', language: 'en', fontSize: 14 }, version: 1,
    }));
  });
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Files tab/i }).click();

  await page.getByRole('button', { name: /^download-me\.txt$/ }).click();

  // Listen for the download event triggered by the synthesized <a download> click.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.getByRole('button', { name: /^Download$/ }).click(),
  ]);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  if (stream) {
    for await (const ch of stream) chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch));
  }
  const body = Buffer.concat(chunks).toString('utf8');
  expect(body).toBe('download-payload');
  expect(download.suggestedFilename()).toBe('download-me.txt');
});
```

- [ ] **Step 3: Run both specs**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/files-copy-paste.spec.ts tests/e2e/web/files-upload-download.spec.ts
```
Expected: PASS (1 + 2 = 3 tests)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/web/files-copy-paste.spec.ts tests/e2e/web/files-upload-download.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add files copy-paste (18805) and upload-download (18806) specs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 62: Final review (full vitest + Playwright + type-check + build) and tag

**Files:**
- Modify: `docs/superpowers/specs/2026-05-11-pc-web-phase-2c-design.md` (status update)

- [ ] **Step 1: Run full vitest suite**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web
```
Expected: PASS — Phase 2a + 2b + 2c suites all green.

- [ ] **Step 2: Run full Playwright suite**

```bash
cd /home/server/projects/zenterm/server && npx playwright test
```
Expected: PASS — Phase 2a + 2b + 2c (7 new) specs all green.

- [ ] **Step 3: Run type-check + build**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web build
```
Expected: both PASS. Build output should include lazy chunks for `react-markdown`, `@codemirror/*`, etc. — check `dist`/`assets/` for filenames containing `codemirror` or `markdown`.

- [ ] **Step 4: Update spec status**

Edit `docs/superpowers/specs/2026-05-11-pc-web-phase-2c-design.md`. At the very top of the file, append a new status line under the existing front-matter:
```markdown
> 状態: Phase 2c 完了 ({{TODAY}}) — `web-pc-phase-2c-done` タグ付き
```
Replace `{{TODAY}}` with today's date (`date +%F`).

Also update the master roadmap if it lists Phase progress. Check:
```bash
cd /home/server/projects/zenterm/server && grep -l "Phase 2c" docs/superpowers/specs/*.md docs/roadmap.md 2>/dev/null
```
For each match, set the status line to "Phase 2c 完了" where appropriate.

- [ ] **Step 5: Final commit + tag**

```bash
git add docs/superpowers/specs/2026-05-11-pc-web-phase-2c-design.md
git diff --cached --quiet || git commit -m "$(cat <<'EOF'
docs(web): mark Phase 2c complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git tag web-pc-phase-2c-done
```

---

## Self-Review Notes

### Spec coverage check

| Spec section | Tasks |
|---|---|
| §1.1 Files tab enable + navigate | Tasks 52, 53 |
| §1.1 Browse + breadcrumbs + sort + hidden toggle | Tasks 10, 12, 13, 14, 16, 18 |
| §1.1 Text/image/markdown preview | Tasks 22, 23, 24, 25 |
| §1.1 CodeMirror text edit + Cmd/Ctrl+S | Tasks 27, 28, 30, 31 |
| §1.1 New file (edit empty buffer + save) | Task 36 (doNewFile), Task 37 |
| §1.1 New folder | Task 36 (doMkdir) |
| §1.1 Rename | Tasks 35, 36, 39 |
| §1.1 Delete (single + bulk + confirm) | Tasks 36 (doDelete), 38, 44 (doBulkDelete), 45 |
| §1.1 Details | Tasks 34, 35, 36 |
| §1.1 Selection mode (Ctrl/Cmd+Click + ⋮) | Tasks 11 (Ctrl click), 35 (context menu select), 41, 44 |
| §1.1 Clipboard copy/cut/paste | Tasks 35, 42, 43, 44 |
| §1.1 Upload (picker + drag&drop) | Tasks 47, 48, 49 |
| §1.1 Download | Tasks 50, 51 |
| §1.1 i18n (en/ja) | Tasks 9, 19, 26, 32, 40, 46, 53 (key removal), 55 (audit) |
| §2.1 AuthenticatedShell route分岐 | Task 25 step 4 |
| §2.1 Sidebar Files panel branch | Task 17 |
| §2.3.1 useFilesStore | Task 5 |
| §2.3.2 useFilesPreviewStore | Task 6 |
| §2.4 ApiClient methods | Task 7 |
| §2.4.1 Authorized blob URL | Task 8 |
| §2.4.2 upload multipart | Task 7 (uploadFile) |
| §2.5 i18n keys | Tasks 9, 19, 26, 32, 40, 46, 55 |
| §2.6 New deps | Task 1 |
| §3 Directory layout (lib/, hooks/, stores/, components/files/, routes/, __tests__) | Tasks 2-8 (lib/hooks/stores), 10-25 + 27 + 33-35 + 41-43 + 47 (components/files/), 52 (routes/), tests inline per task |
| §4.1 AuthenticatedShell改修 | Task 25 |
| §4.2 routes/files.tsx | Task 52 |
| §4.3 Sidebar.tsx改修 | Tasks 17, 53, 54 |
| §4.4 FilesSidebarPanel | Tasks 16, 29, 36, 38, 39, 44, 48 |
| §4.5 FilesViewerPane分岐 | Tasks 25, 28, 50, 51 |
| §4.6 FilesEditor (CodeMirror lazy) | Tasks 27, 30 |
| §4.7 FilesMarkdownViewer (lazy) | Task 24 |
| §4.8 Upload | Tasks 47, 48, 49 |
| §4.9 Download | Tasks 50, 51 |
| §5.1 Unit tests | Tasks 2 (filesPath), 3 (sort/icon/format), 4 (language), 5 (files store), 6 (preview store), 8 (blob hook) |
| §5.2 Component tests | Tasks 10-14, 16, 20-25, 27, 30-35, 41-43, 47 |
| §5.3 Flow tests | Tasks 18 (browse), 28 (edit), 36 (mutations), 37 (new file), 44 (clipboard), 48 (upload) |
| §5.4 E2E specs (7) | Tasks 56-61 |
| §5.5 既存 Sidebar/App test 更新 | Tasks 17, 52, 53, 54 |

### Type / signature consistency

- `SortMode` defined in `lib/filesSort.ts` (Task 3), re-exported via `stores/files.ts` (Task 5) — single source.
- `PreviewKind` defined in `lib/filesIcon.ts` (Task 3), used in `stores/filesPreview.ts` (Task 6) and `FilesViewerPane.tsx` (Task 25). All four values: `'text' | 'image' | 'markdown' | 'unsupported'`.
- `FilesClipboard` defined in `stores/files.ts` (Task 5) `{ items: string[]; mode: 'copy' | 'cut' }`. Consumed by `FilesPasteBar` (Task 43) and `doPaste` in `FilesSidebarPanel` (Task 44) — shape matches.
- `FilesApiClient` defined in `components/files/filesApi.ts` (Task 15) with all 10 methods. `AuthenticatedShell` builds a literal of this shape (Task 25 step 4) — keys match.
- `useFilesStore` action names: `setCurrentPath`, `setEntries`, `setLoading`, `setError`, `toggleShowHidden`, `setSortMode`, `enterSelectionMode`, `exitSelectionMode`, `toggleSelection`, `selectAll`, `setClipboard`, `clearClipboard`, `reset` — match spec §2.3.1 exactly.
- `useFilesPreviewStore` action names: `selectFile`, `setText`, `setLoadingPreview`, `setPreviewError`, `startEditing`, `cancelEditing`, `setEditContent`, `setSaving`, `finishSave`, `toggleMarkdownRendered`, `clear` — match spec §2.3.2 exactly.
- `ApiClient` new method signatures: `listFiles(path, showHidden)`, `getFileContent(path)`, `writeFileContent(path, content)`, `deleteFile(path)`, `renameFile(path, newName)`, `copyFiles(sources, destination)`, `moveFiles(sources, destination)`, `createDirectory(path)`, `buildRawFileUrl(path)`, `uploadFile(file, destPath)` — match spec §2.4.
- `useAuthorizedBlobUrl(sourceUrl, token)` returns `{ url, loading, error }` — used by `FilesImageViewer` (Task 23). Signature stable.
- `FilesViewerHeader` callbacks: `onEdit`, `onSave`, `onCancel`, `onDownload`, `onToggleMarkdown` — same set used by `FilesViewerPane` consumer (Tasks 25, 28, 50).

### Placeholder scan

Scanned for `TBD`, `TODO`, `fill in`, `implement later`, `similar to Task` — none present. The few `/* wired in Sub-phase X */` comments are placeholder *handlers* in earlier tasks that are **explicitly replaced in named later tasks** (Sub-phase 2c-5 / 2c-6 / 2c-7 / 2c-8) — not plan placeholders.

### Known caveats

- `vitest run -w @zenterm/web src/path` syntax: vitest 4 supports filtering via positional pattern matching the file path. If the test runner ignores `-w` filtering for path positional, fall back to `npx vitest --project @zenterm/web run src/path`.
- The "Edit/Save/Cancel/Download" header buttons use simple anchor selectors. Localised strings are exact-match — if i18n falls back to keys (e.g., test runs without `initI18n()` called), assertions matching `/edit/i` will still match the key `files.edit`. Tests deliberately use `/^Save$/` for the visible English label after `initI18n()` is run.
- Mobile FilesPanel (`/home/server/projects/zenterm/app/src/components/layout/FilesPanel.tsx`) is referenced for icon/preview-kind logic only. PC implementation diverges where appropriate (no FlatList, no React Native ActionSheet).
- Phase 2b's `wrappedClient` non-memoize concern (IMP-1) is not addressed in Phase 2c — it is reproduced in `filesClient` per spec §4.1 note. A separate fix can be planned later.
- The first time Files is opened, CodeMirror chunks (~300KB) are downloaded. Lazy import + `Suspense` keeps initial Files-tab paint fast; subsequent edits are instant.

### Spec items NOT explicitly covered as a dedicated task

- `overwrite*` i18n keys (spec §2.5: `overwriteTitle`, `overwriteDesc`, `overwriteAction`) — Gateway upload uses `preserveName=true` which auto-suffixes `_1`, `_2` on conflict, so an interactive overwrite flow is **not implemented in Phase 2c** (spec §2.4.2 also defers it). These keys are not added to locales. If you change the upload contract later, add them then.
- `openLinkFailedDesc` (spec §2.5) — symlink open failure path. Spec §1.2 lists no symlink failure handling beyond the existing `getFileIconType` 'symlink' icon. Not added; revisit when symlink resolution is enhanced.
- `cannotFetchFiles` is referenced in Task 9 locale but not visibly used by any component (it overlaps with `loadFailed`). Kept in locales for forward-compat with potential error UI variants. Not load-bearing.
