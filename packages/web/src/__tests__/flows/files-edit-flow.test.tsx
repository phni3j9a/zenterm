import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useUiStore } from '@/stores/ui';
import { FilesViewerPane } from '@/components/files/FilesViewerPane';

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea data-testid="cm-mock" defaultValue={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

const makeClient = () => ({
  listFiles: vi.fn(), deleteFile: vi.fn(), renameFile: vi.fn(), copyFiles: vi.fn(),
  moveFiles: vi.fn(), createDirectory: vi.fn(), uploadFile: vi.fn(),
  buildRawFileUrl: () => '',
  getFileContent: vi.fn().mockResolvedValue({ path: '~/a.ts', content: 'old', lines: 1, truncated: false }),
  writeFileContent: vi.fn().mockResolvedValue({ path: '~/a.ts', bytes: 3 }),
});

describe('Files edit flow', () => {
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('select → edit → save → toast + finishSave', async () => {
    const client = makeClient();
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');

    render(<FilesViewerPane client={client as any} token="tok" />);
    await waitFor(() => expect(client.getFileContent).toHaveBeenCalled());

    // Click Edit in header
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Type new content
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.change(ta, { target: { value: 'new content' } });

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(client.writeFileContent).toHaveBeenCalledWith('~/a.ts', 'new content'));
    await waitFor(() => expect(useFilesPreviewStore.getState().textContent).toBe('new content'));
    await waitFor(() => expect(useUiStore.getState().toasts.some((t) => t.type === 'success')).toBe(true));
    expect(useFilesPreviewStore.getState().isEditing).toBe(false);
  });
});
