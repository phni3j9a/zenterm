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
