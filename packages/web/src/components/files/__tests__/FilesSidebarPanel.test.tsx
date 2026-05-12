import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesStore } from '@/stores/files';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesSidebarPanel } from '../FilesSidebarPanel';

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter initialEntries={['/web/files']}>{ui}</MemoryRouter>);

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

const makeClient = () => ({
  listFiles: vi.fn().mockResolvedValue({
    path: '~',
    entries: [
      { name: 'src', type: 'directory', size: 0, modified: 0, permissions: 'rwxr-xr-x' },
      { name: 'README.md', type: 'file', size: 50, modified: 0, permissions: 'rw-r--r--' },
    ],
  }),
});

describe('FilesSidebarPanel', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
    useFilesPreviewStore.getState().clear();
  });

  it('on mount fetches the current path and renders entries', async () => {
    const client = makeClient();
    renderInRouter(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalledWith('~', false));
    await waitFor(() => expect(screen.getByRole('button', { name: /src/ })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument();
  });

  it('clicking a directory navigates into it (re-fetches)', async () => {
    const client = makeClient();
    renderInRouter(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /src/ })).toBeInTheDocument());
    client.listFiles.mockResolvedValueOnce({ path: '~/src', entries: [] });
    fireEvent.click(screen.getByRole('button', { name: /src/ }));
    await waitFor(() => expect(client.listFiles).toHaveBeenLastCalledWith('~/src', false));
  });

  it('clicking a text file selects it in preview store', async () => {
    const client = makeClient();
    renderInRouter(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /README\.md/ }));
    expect(useFilesPreviewStore.getState().selectedName).toBe('README.md');
    expect(useFilesPreviewStore.getState().selectedKind).toBe('markdown');
  });

  it('breadcrumb home click resets to ~', async () => {
    const client = makeClient();
    useFilesStore.setState({ currentPath: '~/src' });
    renderInRouter(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(client.listFiles).toHaveBeenCalledWith('~/src', false));
    client.listFiles.mockResolvedValueOnce({ path: '~', entries: [] });
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    await waitFor(() => expect(client.listFiles).toHaveBeenLastCalledWith('~', false));
  });

  it('shows unsaved-changes confirm when switching while dirty', async () => {
    const client = makeClient();
    renderInRouter(<FilesSidebarPanel client={client as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /README\.md/ })).toBeInTheDocument());

    // Simulate dirty edit state on a different file
    useFilesPreviewStore.getState().selectFile('~/other.ts', 'other.ts', 'text');
    useFilesPreviewStore.getState().setText('a', 1, false);
    useFilesPreviewStore.getState().startEditing();
    useFilesPreviewStore.getState().setEditContent('changed');

    // Click README.md in the list
    fireEvent.click(screen.getByRole('button', { name: /README\.md/ }));

    // The confirm dialog should be queued
    const { useUiStore } = await import('@/stores/ui');
    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    expect(useUiStore.getState().confirmDialog?.title).toMatch(/unsaved/i);
  });
});
