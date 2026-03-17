import type { FileEntry } from '../types';

// Replicate the file icon detection logic from files.tsx for testing
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.json', '.yaml', '.yml', '.toml', '.md',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
]);

type FileIconType = 'folder' | 'code' | 'image' | 'text' | 'symlink' | 'other';

function getFileIconType(entry: FileEntry): FileIconType {
  if (entry.type === 'directory') return 'folder';
  if (entry.type === 'symlink') return 'symlink';
  if (entry.type === 'other') return 'other';

  const ext = entry.name.includes('.') ? `.${entry.name.split('.').pop()?.toLowerCase()}` : '';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'text';
}

const makeEntry = (name: string, type: FileEntry['type'] = 'file'): FileEntry => ({
  name,
  type,
  size: 100,
  modified: 1000,
  permissions: '-rw-r--r--',
});

describe('getFileIconType', () => {
  it('returns folder for directories', () => {
    expect(getFileIconType(makeEntry('src', 'directory'))).toBe('folder');
  });

  it('returns symlink for symlinks', () => {
    expect(getFileIconType(makeEntry('link', 'symlink'))).toBe('symlink');
  });

  it('returns other for other types', () => {
    expect(getFileIconType(makeEntry('device', 'other'))).toBe('other');
  });

  it('returns code for TypeScript files', () => {
    expect(getFileIconType(makeEntry('index.ts'))).toBe('code');
    expect(getFileIconType(makeEntry('App.tsx'))).toBe('code');
  });

  it('returns code for JavaScript files', () => {
    expect(getFileIconType(makeEntry('main.js'))).toBe('code');
    expect(getFileIconType(makeEntry('App.jsx'))).toBe('code');
  });

  it('returns code for Python files', () => {
    expect(getFileIconType(makeEntry('script.py'))).toBe('code');
  });

  it('returns code for shell scripts', () => {
    expect(getFileIconType(makeEntry('deploy.sh'))).toBe('code');
  });

  it('returns code for config files', () => {
    expect(getFileIconType(makeEntry('config.json'))).toBe('code');
    expect(getFileIconType(makeEntry('docker-compose.yaml'))).toBe('code');
    expect(getFileIconType(makeEntry('config.yml'))).toBe('code');
    expect(getFileIconType(makeEntry('pyproject.toml'))).toBe('code');
  });

  it('returns code for markdown files', () => {
    expect(getFileIconType(makeEntry('README.md'))).toBe('code');
  });

  it('returns image for image files', () => {
    expect(getFileIconType(makeEntry('photo.png'))).toBe('image');
    expect(getFileIconType(makeEntry('photo.jpg'))).toBe('image');
    expect(getFileIconType(makeEntry('photo.jpeg'))).toBe('image');
    expect(getFileIconType(makeEntry('animation.gif'))).toBe('image');
    expect(getFileIconType(makeEntry('icon.svg'))).toBe('image');
    expect(getFileIconType(makeEntry('hero.webp'))).toBe('image');
  });

  it('returns text for unknown extensions', () => {
    expect(getFileIconType(makeEntry('readme.txt'))).toBe('text');
    expect(getFileIconType(makeEntry('data.csv'))).toBe('text');
  });

  it('returns text for files without extension', () => {
    expect(getFileIconType(makeEntry('Makefile'))).toBe('text');
  });

  it('handles case-insensitive extensions', () => {
    expect(getFileIconType(makeEntry('Photo.PNG'))).toBe('image');
    expect(getFileIconType(makeEntry('script.PY'))).toBe('code');
  });
});
