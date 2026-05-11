import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesStore } from '@/stores/files';
import { FilesSelectionHeader } from '../FilesSelectionHeader';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesSelectionHeader', () => {
  beforeEach(() => useFilesStore.getState().reset());

  it('shows selected count', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a', 'b']) });
    render(<FilesSelectionHeader />);
    expect(screen.getByText(/2 selected|2 件選択中/)).toBeInTheDocument();
  });

  it('select all selects every entry', () => {
    useFilesStore.setState({
      selectionMode: true,
      selectedNames: new Set(),
      entries: [
        { name: 'a', type: 'file', size: 0, modified: 0, permissions: '' },
        { name: 'b', type: 'file', size: 0, modified: 0, permissions: '' },
      ],
    });
    render(<FilesSelectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    expect(useFilesStore.getState().selectedNames.size).toBe(2);
  });

  it('close button exits selection mode', () => {
    useFilesStore.setState({ selectionMode: true, selectedNames: new Set(['a']) });
    render(<FilesSelectionHeader />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(useFilesStore.getState().selectionMode).toBe(false);
  });
});
