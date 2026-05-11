import { beforeEach, describe, expect, it } from 'vitest';
import { useFilesPreviewStore } from '../filesPreview';

describe('useFilesPreviewStore', () => {
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
  });

  it('starts cleared', () => {
    const s = useFilesPreviewStore.getState();
    expect(s.selectedPath).toBeNull();
    expect(s.selectedName).toBeNull();
    expect(s.selectedKind).toBeNull();
    expect(s.textContent).toBeNull();
    expect(s.isEditing).toBe(false);
    expect(s.isDirty).toBe(false);
    expect(s.showMarkdownRendered).toBe(true);
  });

  it('selectFile sets path/name/kind and clears text', () => {
    useFilesPreviewStore.getState().setText('old', 1, false);
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    const s = useFilesPreviewStore.getState();
    expect(s.selectedPath).toBe('~/a.ts');
    expect(s.selectedName).toBe('a.ts');
    expect(s.selectedKind).toBe('text');
    expect(s.textContent).toBeNull();
    expect(s.isEditing).toBe(false);
  });

  it('setText stores content + lines + truncated', () => {
    useFilesPreviewStore.getState().setText('hello\nworld', 2, false);
    const s = useFilesPreviewStore.getState();
    expect(s.textContent).toBe('hello\nworld');
    expect(s.textLines).toBe(2);
    expect(s.textTruncated).toBe(false);
  });

  it('startEditing copies textContent into editContent', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    const s = useFilesPreviewStore.getState();
    expect(s.isEditing).toBe(true);
    expect(s.editContent).toBe('hi');
    expect(s.isDirty).toBe(false);
  });

  it('setEditContent flags isDirty when different from textContent', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('hi');
    expect(useFilesPreviewStore.getState().isDirty).toBe(false);
    useFilesPreviewStore.getState().setEditContent('changed');
    expect(useFilesPreviewStore.getState().isDirty).toBe(true);
  });

  it('cancelEditing exits and clears dirty', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');
    useFilesPreviewStore.getState().cancelEditing();
    const s = useFilesPreviewStore.getState();
    expect(s.isEditing).toBe(false);
    expect(s.isDirty).toBe(false);
  });

  it('finishSave persists savedContent into textContent and exits edit', () => {
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('saved');
    useFilesPreviewStore.getState().finishSave('saved');
    const s = useFilesPreviewStore.getState();
    expect(s.textContent).toBe('saved');
    expect(s.isEditing).toBe(false);
    expect(s.isDirty).toBe(false);
    expect(s.saving).toBe(false);
  });

  it('toggleMarkdownRendered flips boolean', () => {
    expect(useFilesPreviewStore.getState().showMarkdownRendered).toBe(true);
    useFilesPreviewStore.getState().toggleMarkdownRendered();
    expect(useFilesPreviewStore.getState().showMarkdownRendered).toBe(false);
  });
});
