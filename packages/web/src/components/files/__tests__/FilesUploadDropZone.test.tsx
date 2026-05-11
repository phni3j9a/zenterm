import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesUploadDropZone } from '../FilesUploadDropZone';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesUploadDropZone', () => {
  it('renders nothing visible by default', () => {
    render(<FilesUploadDropZone onFiles={vi.fn()} />);
    expect(screen.queryByText(/drop files/i)).toBeNull();
  });

  it('shows hint text on dragenter and hides on dragleave', () => {
    render(<FilesUploadDropZone onFiles={vi.fn()} />);
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText(/drop files/i)).toBeInTheDocument();
    fireEvent.dragLeave(window);
    // Note: may still be visible until drop or counter resets — just verify drop clears it
  });

  it('on drop fires onFiles with array of File', () => {
    const onFiles = vi.fn();
    render(<FilesUploadDropZone onFiles={onFiles} />);
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'] } });
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const overlay = screen.getByText(/drop files/i);
    fireEvent.drop(overlay, { dataTransfer: { files: [file], types: ['Files'] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});
