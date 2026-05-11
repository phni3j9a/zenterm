import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesViewerEmpty } from '../FilesViewerEmpty';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesViewerEmpty', () => {
  it('default mode shows preview title and description', () => {
    render(<FilesViewerEmpty />);
    expect(screen.getByText(/no file selected/i)).toBeInTheDocument();
    expect(screen.getByText(/select a file/i)).toBeInTheDocument();
  });

  it('unsupported mode shows cannotOpen with name', () => {
    render(<FilesViewerEmpty mode="unsupported" name="archive.zip" />);
    expect(screen.getByText(/cannot open/i)).toBeInTheDocument();
    expect(screen.getByText(/archive\.zip/)).toBeInTheDocument();
  });
});
