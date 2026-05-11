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
