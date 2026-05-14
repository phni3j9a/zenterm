import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesViewerHeader } from '../FilesViewerHeader';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

interface RenderOpts {
  name?: string;
  kind?: 'text' | 'image' | 'markdown' | 'unsupported';
  isEditing?: boolean;
  isDirty?: boolean;
  saving?: boolean;
  showMarkdownRendered?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onDownload?: () => void;
  onToggleMarkdown?: () => void;
  onClose?: () => void;
}

function renderHeader(opts: RenderOpts = {}) {
  const props = {
    name: 'a.ts',
    kind: 'text' as const,
    isEditing: false,
    isDirty: false,
    saving: false,
    showMarkdownRendered: false,
    onEdit: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onDownload: vi.fn(),
    onToggleMarkdown: vi.fn(),
    onClose: vi.fn(),
    ...opts,
  };
  return { props, ...render(<FilesViewerHeader {...props} />) };
}

describe('FilesViewerHeader', () => {
  it('shows filename + Edit + Download buttons for text file (read-only)', () => {
    renderHeader({ name: 'a.ts', kind: 'text' });
    expect(screen.getByText('a.ts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('shows Save + Cancel when isEditing', () => {
    renderHeader({ name: 'a.ts', kind: 'text', isEditing: true });
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
  });

  it('shows toggle Rendered/Source button for markdown', () => {
    renderHeader({ name: 'r.md', kind: 'markdown' });
    expect(screen.getByRole('button', { name: /source|rendered/i })).toBeInTheDocument();
  });

  it('clicking Edit fires onEdit', () => {
    const onEdit = vi.fn();
    renderHeader({ name: 'a.ts', kind: 'text', onEdit });
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('× ボタンで onClose を呼ぶ', () => {
    const onClose = vi.fn();
    renderHeader({ name: 'a.ts', kind: 'text', onClose });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
