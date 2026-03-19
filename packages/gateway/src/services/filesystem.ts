import { type Stats, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FileContentResponse, FileEntry, FileListResponse, FileWriteResponse } from '../types/index.js';

const homeDir = process.env.HOME ?? process.cwd();
const homeDirPrefix = homeDir + '/';
const MAX_FILE_SIZE = 512 * 1024; // 512KB
const MAX_CONTENT_LINES = 1000;

export class FilesystemError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code = 'FS_ERROR',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'FilesystemError';
  }
}

function isWithinHome(absPath: string): boolean {
  return absPath === homeDir || absPath.startsWith(homeDirPrefix);
}

function assertPathWithinHome(absPath: string): void {
  if (isWithinHome(absPath)) return;
  throw new FilesystemError('ホームディレクトリ外へのアクセスは許可されていません。', 403, 'PATH_TRAVERSAL');
}

function assertSymlinkWithinHome(absPath: string): void {
  if (isWithinHome(absPath)) return;
  throw new FilesystemError('シンボリックリンク先がホームディレクトリ外です。', 403, 'SYMLINK_TRAVERSAL');
}

function assertExistingParentWithinHome(resolved: string, inputPath: string): void {
  try {
    assertSymlinkWithinHome(realpathSync(dirname(resolved)));
  } catch (error) {
    if (error instanceof FilesystemError) throw error;
    throw new FilesystemError(`親ディレクトリが存在しません: ${inputPath}`, 404, 'PARENT_NOT_FOUND');
  }
}

function assertResolvedSymlinkWithinHome(resolved: string, inputPath: string): void {
  try {
    assertSymlinkWithinHome(realpathSync(resolved));
  } catch (error) {
    if (error instanceof FilesystemError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    assertExistingParentWithinHome(resolved, inputPath);
  }
}

export function validatePath(inputPath: string): string {
  const expanded = inputPath.startsWith('~') ? inputPath.replace('~', homeDir) : inputPath;
  const resolved = resolve(homeDir, expanded);
  assertPathWithinHome(resolved);
  assertResolvedSymlinkWithinHome(resolved, inputPath);
  return resolved;
}

function formatPermissions(mode: number): string {
  const types: Record<number, string> = {
    0o140000: 's', // socket
    0o120000: 'l', // symlink
    0o100000: '-', // file
    0o060000: 'b', // block device
    0o040000: 'd', // directory
    0o020000: 'c', // char device
    0o010000: 'p'  // FIFO
  };

  const fileType = Object.entries(types).find(([mask]) => (mode & 0o170000) === Number(mask));
  const prefix = fileType?.[1] ?? '?';

  const perms = [
    mode & 0o400 ? 'r' : '-',
    mode & 0o200 ? 'w' : '-',
    mode & 0o100 ? 'x' : '-',
    mode & 0o040 ? 'r' : '-',
    mode & 0o020 ? 'w' : '-',
    mode & 0o010 ? 'x' : '-',
    mode & 0o004 ? 'r' : '-',
    mode & 0o002 ? 'w' : '-',
    mode & 0o001 ? 'x' : '-'
  ];

  return prefix + perms.join('');
}

function getFileType(stats: Stats): FileEntry['type'] {
  if (stats.isSymbolicLink()) return 'symlink';
  if (stats.isDirectory()) return 'directory';
  if (stats.isFile()) return 'file';
  return 'other';
}

function buildFileEntry(dirPath: string, name: string): FileEntry {
  const fullPath = resolve(dirPath, name);
  const lstats = lstatSync(fullPath);
  const type = getFileType(lstats);

  const entry: FileEntry = {
    name,
    type,
    size: lstats.size,
    modified: lstats.mtimeMs,
    permissions: formatPermissions(lstats.mode)
  };

  if (type === 'symlink') {
    try {
      const target = readlinkSync(fullPath);
      entry.symlinkTarget = target;

      // Resolve real target and use its stats for size
      const realStats = statSync(fullPath);
      entry.size = realStats.size;

      // Validate symlink target is within HOME
      const resolvedTarget = resolve(dirPath, target);
      if (!isWithinHome(resolvedTarget)) {
        entry.symlinkTarget = target + ' (outside home)';
      }
    } catch {
      entry.symlinkTarget = '(broken)';
    }
  }

  return entry;
}

function getExistingStats(targetPath: string, inputPath: string): Stats {
  try {
    return statSync(targetPath);
  } catch (error) {
    throw new FilesystemError(
      `パスが見つかりません: ${inputPath}`,
      404,
      'PATH_NOT_FOUND',
      { cause: error }
    );
  }
}

function assertDirectory(stats: Stats, inputPath: string): void {
  if (!stats.isDirectory()) {
    throw new FilesystemError(
      `ディレクトリではありません: ${inputPath}`,
      400,
      'NOT_A_DIRECTORY'
    );
  }
}

function readDirectoryNames(dirPath: string, inputPath: string, showHidden: boolean): string[] {
  try {
    const names = readdirSync(dirPath);
    if (showHidden) {
      return names;
    }
    return names.filter((name) => !name.startsWith('.'));
  } catch (error) {
    throw new FilesystemError(
      `ディレクトリの読み取りに失敗しました: ${inputPath}`,
      403,
      'READ_DENIED',
      { cause: error }
    );
  }
}

function sortEntries(entries: FileEntry[]): void {
  entries.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

export function listDirectory(inputPath: string, showHidden = true): FileListResponse {
  const dirPath = validatePath(inputPath);
  const stats = getExistingStats(dirPath, inputPath);
  assertDirectory(stats, inputPath);
  const names = readDirectoryNames(dirPath, inputPath, showHidden);
  const entries: FileEntry[] = [];

  for (const name of names) {
    try {
      entries.push(buildFileEntry(dirPath, name));
    } catch {
      // Skip entries we cannot stat
    }
  }

  sortEntries(entries);
  return { path: dirPath, entries };
}

export function readFileContent(inputPath: string): FileContentResponse {
  const filePath = validatePath(inputPath);

  let stats;
  try {
    stats = statSync(filePath);
  } catch (error) {
    throw new FilesystemError(
      `ファイルが見つかりません: ${inputPath}`,
      404,
      'FILE_NOT_FOUND',
      { cause: error }
    );
  }

  if (!stats.isFile()) {
    throw new FilesystemError(
      `ファイルではありません: ${inputPath}`,
      400,
      'NOT_A_FILE'
    );
  }

  if (stats.size > MAX_FILE_SIZE) {
    throw new FilesystemError(
      `ファイルサイズが上限（512KB）を超えています。`,
      413,
      'FILE_TOO_LARGE'
    );
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new FilesystemError(
      `ファイルの読み取りに失敗しました: ${inputPath}`,
      403,
      'READ_DENIED',
      { cause: error }
    );
  }

  const allLines = content.split('\n');
  const truncated = allLines.length > MAX_CONTENT_LINES;

  if (truncated) {
    content = allLines.slice(0, MAX_CONTENT_LINES).join('\n');
  }

  return {
    path: filePath,
    content,
    lines: truncated ? MAX_CONTENT_LINES : allLines.length,
    truncated
  };
}

function assertWritableFile(filePath: string, inputPath: string): void {
  try {
    const stats = statSync(filePath);
    if (!stats.isDirectory()) {
      return;
    }
    throw new FilesystemError(
      `ディレクトリには書き込めません: ${inputPath}`,
      400,
      'NOT_A_FILE'
    );
  } catch (error) {
    if (error instanceof FilesystemError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

function writeUtf8File(filePath: string, inputPath: string, content: string): void {
  try {
    writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new FilesystemError(
      `ファイルの書き込みに失敗しました: ${inputPath}`,
      403,
      'WRITE_DENIED',
      { cause: error }
    );
  }
}

export function writeFileContent(inputPath: string, content: string): FileWriteResponse {
  const filePath = validatePath(inputPath);
  const bytes = Buffer.byteLength(content, 'utf8');

  if (bytes > MAX_FILE_SIZE) {
    throw new FilesystemError('ファイルサイズが上限（512KB）を超えています。', 413, 'FILE_TOO_LARGE');
  }

  assertWritableFile(filePath, inputPath);
  writeUtf8File(filePath, inputPath, content);
  return { path: filePath, bytes };
}
