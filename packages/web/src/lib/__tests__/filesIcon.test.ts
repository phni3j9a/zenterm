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
