import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import type { FileEntry } from '@zenterm/shared';
import { FilesContextMenu } from '../FilesContextMenu';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

const entry: FileEntry = { name: 'a.ts', type: 'file', size: 0, modified: 0, permissions: 'rw-r--r--' };

describe('FilesContextMenu', () => {
  it('renders rename/copy/cut/delete/details menu items', () => {
    render(<FilesContextMenu entry={entry} x={10} y={10} onClose={vi.fn()} onRename={vi.fn()} onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} onDetails={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole('menuitem', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /cut/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /details/i })).toBeInTheDocument();
  });

  it('rename click fires onRename and onClose', () => {
    const onRename = vi.fn();
    const onClose = vi.fn();
    render(<FilesContextMenu entry={entry} x={0} y={0} onClose={onClose} onRename={onRename} onCopy={vi.fn()} onCut={vi.fn()} onDelete={vi.fn()} onDetails={vi.fn()} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    expect(onRename).toHaveBeenCalledWith(entry);
    expect(onClose).toHaveBeenCalled();
  });
});
