import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FileEntry } from '@zenterm/shared';
import { FilesList } from '../FilesList';
import { useFilesStore } from '@/stores/files';
import { useSettingsStore } from '@/stores/settings';
import { initI18n } from '@/i18n';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

const f = (name: string, type: FileEntry['type'] = 'file'): FileEntry => ({
  name, type, size: 100, modified: 0, permissions: 'rw-r--r--',
});

describe('FilesList', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
  });

  it('renders entries sorted by name-asc with directories first', () => {
    useFilesStore.setState({
      entries: [f('z.ts'), f('dir', 'directory'), f('a.ts')],
      sortMode: 'name-asc',
      showHidden: false,
    });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['dir', 'a.ts', 'z.ts']);
  });

  it('hides hidden (.) files when showHidden=false', () => {
    useFilesStore.setState({
      entries: [f('.hidden'), f('visible.ts')],
      showHidden: false,
    });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /\.hidden/ })).toBeNull();
    expect(screen.getByRole('button', { name: /visible\.ts/ })).toBeInTheDocument();
  });

  it('shows hidden files when showHidden=true', () => {
    useFilesStore.setState({
      entries: [f('.hidden'), f('visible.ts')],
      showHidden: true,
    });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByRole('button', { name: /\.hidden/ })).toBeInTheDocument();
  });

  it('renders empty state text when entries are empty', () => {
    useFilesStore.setState({ entries: [], loading: false });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByText(/empty directory/i)).toBeInTheDocument();
  });

  it('shows skeleton loading state when loading and entries are empty', () => {
    useFilesStore.setState({ entries: [], loading: true });
    render(<FilesList onOpen={vi.fn()} onContextMenu={vi.fn()} onLongPress={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
