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
