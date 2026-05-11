import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesStore } from '@/stores/files';
import { FilesSortMenu } from '../FilesSortMenu';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesSortMenu', () => {
  beforeEach(() => {
    useFilesStore.getState().reset();
  });

  it('renders 4 radio options', () => {
    render(<FilesSortMenu onClose={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('selecting a radio updates store sortMode', () => {
    const onClose = vi.fn();
    render(<FilesSortMenu onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: /size/i }));
    expect(useFilesStore.getState().sortMode).toBe('size-desc');
    expect(onClose).toHaveBeenCalled();
  });

  it('marks current sortMode as checked', () => {
    useFilesStore.setState({ sortMode: 'modified-desc' });
    render(<FilesSortMenu onClose={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /modified/i })).toBeChecked();
  });
});
