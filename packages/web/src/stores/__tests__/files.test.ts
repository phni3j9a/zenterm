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
