import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { FilesTextViewer } from '../FilesTextViewer';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesTextViewer', () => {
  beforeEach(() => useFilesPreviewStore.getState().clear());

  it('renders content lines', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('line1\nline2\nline3', 3, false);
    render(<FilesTextViewer />);
    expect(screen.getByText('line1')).toBeInTheDocument();
    expect(screen.getByText('line3')).toBeInTheDocument();
  });

  it('shows truncated indicator when truncated', () => {
    useFilesPreviewStore.getState().selectFile('~/a.ts', 'a.ts', 'text');
    useFilesPreviewStore.getState().setText('x', 1, true);
    render(<FilesTextViewer />);
    expect(screen.getByText(/truncated/i)).toBeInTheDocument();
  });

  it('renders nothing when no textContent', () => {
    const { container } = render(<FilesTextViewer />);
    expect(container.querySelector('pre')).toBeNull();
  });
});
