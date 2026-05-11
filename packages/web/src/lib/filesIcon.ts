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
