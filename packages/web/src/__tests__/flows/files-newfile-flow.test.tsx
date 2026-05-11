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
  getFileContent: vi.fn(),
  writeFileContent: vi.fn().mockResolvedValue({ path: '~/new.ts', bytes: 4 }),
});

describe('Files new-file flow', () => {
  beforeEach(() => {
    useFilesPreviewStore.getState().clear();
    useUiStore.setState({ toasts: [], confirmDialog: null });
  });

  it('writeFileContent is called when user saves a brand-new buffer', async () => {
    const client = makeClient();
    // Simulate the state set up by doNewFile in Task 36
    useFilesPreviewStore.getState().selectFile('~/new.ts', 'new.ts', 'text');
    useFilesPreviewStore.getState().setText('', 0, false);
    useFilesPreviewStore.getState().startEditing();

    render(<FilesViewerPane client={client as any} token="tok" />);
    const ta = await screen.findByTestId('cm-mock');
    fireEvent.change(ta, { target: { value: 'body' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(client.writeFileContent).toHaveBeenCalledWith('~/new.ts', 'body'));
  });
});
