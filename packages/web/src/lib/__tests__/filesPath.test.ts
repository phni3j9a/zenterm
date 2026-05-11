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
