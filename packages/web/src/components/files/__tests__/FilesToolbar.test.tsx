import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesStore } from '@/stores/files';
import { FilesToolbar } from '../FilesToolbar';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesToolbar', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
  });

  it('renders sort, hidden toggle, upload, new buttons', () => {
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hidden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
  });

  it('clicking hidden toggle flips store flag', () => {
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /hidden/i }));
    expect(useFilesStore.getState().showHidden).toBe(true);
  });

  it('clicking upload fires onUploadClick', () => {
    const onUploadClick = vi.fn();
    render(<FilesToolbar onUploadClick={onUploadClick} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(onUploadClick).toHaveBeenCalled();
  });

  it('clicking sort opens FilesSortMenu', () => {
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={vi.fn()} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sort/i }));
    expect(screen.getByRole('menu', { name: /sort/i })).toBeInTheDocument();
  });

  it('clicking new opens new menu and selecting newFile fires callback', () => {
    const onNewFile = vi.fn();
    render(<FilesToolbar onUploadClick={vi.fn()} onNewFile={onNewFile} onNewFolder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /new file/i }));
    expect(onNewFile).toHaveBeenCalled();
  });
});
