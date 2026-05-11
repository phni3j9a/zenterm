import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesViewerHeader } from '../FilesViewerHeader';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesViewerHeader', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('returns null when nothing selected', () => {
    const { container } = render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows filename + Edit + Download buttons for text file (read-only)', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByText('a.ts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('shows Save + Cancel when isEditing', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    useFilesPreviewStore.getState().startEditing();
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
  });

  it('shows toggle Rendered/Source button for markdown', () => {
    useFilesPreviewStore.getState().selectFile('~/r.md', 'r.md', 'markdown');
    useFilesPreviewStore.getState().setText('# hi', 1, false);
    render(<FilesViewerHeader onEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    expect(screen.getByRole('button', { name: /source|rendered/i })).toBeInTheDocument();
  });

  it('clicking Edit fires onEdit', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('hi', 1, false);
    const onEdit = vi.fn();
    render(<FilesViewerHeader onEdit={onEdit} onSave={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} onToggleMarkdown={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();
  });
});
