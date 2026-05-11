import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FileEntry } from '@zenterm/shared';
import { FilesItem } from '../FilesItem';

const dir: FileEntry = { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' };
const file: FileEntry = { name: 'a.ts', type: 'file', size: 123, modified: 1704153600, permissions: 'rw-r--r--' };

describe('FilesItem', () => {
  it('renders directory name and triggers onOpen with entry on click', () => {
    const onOpen = vi.fn();
    const onContext = vi.fn();
    const onLongPress = vi.fn();
    render(<FilesItem entry={dir} selected={false} selectionMode={false} onOpen={onOpen} onContextMenu={onContext} onLongPress={onLongPress} />);
    fireEvent.click(screen.getByRole('button', { name: /src/ }));
    expect(onOpen).toHaveBeenCalledWith(dir);
  });

  it('shows checkbox state when in selectionMode', () => {
    const onOpen = vi.fn();
    render(<FilesItem entry={file} selected selectionMode onOpen={onOpen} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('Ctrl+Click triggers onLongPress (start selection)', () => {
    const onOpen = vi.fn();
    const onLongPress = vi.fn();
    render(<FilesItem entry={file} selected={false} selectionMode={false} onOpen={onOpen} onContextMenu={vi.fn()} onLongPress={onLongPress} />);
    fireEvent.click(screen.getByRole('button', { name: /a\.ts/ }), { ctrlKey: true });
    expect(onLongPress).toHaveBeenCalledWith(file);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('contextmenu fires onContextMenu', () => {
    const onContext = vi.fn();
    render(<FilesItem entry={file} selected={false} selectionMode={false} onOpen={vi.fn()} onContextMenu={onContext} onLongPress={vi.fn()} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: /a\.ts/ }));
    expect(onContext).toHaveBeenCalled();
  });

  it('renders file size for non-directory', () => {
    render(<FilesItem entry={file} selected={false} selectionMode={false} onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByText(/123 B/)).toBeInTheDocument();
  });
});
