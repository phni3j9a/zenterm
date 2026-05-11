import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerHeader } from '../FilesViewerHeader';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesViewerHeader save button state', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('save disabled when not dirty', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('save enabled when dirty', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('save disabled while saving even if dirty', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');
    useFilesPreviewStore.getState().setSaving(true);
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });
});
