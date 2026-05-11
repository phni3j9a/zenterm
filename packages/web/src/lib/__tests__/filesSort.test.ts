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
