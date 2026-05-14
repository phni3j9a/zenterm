import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesTextViewer } from '../FilesTextViewer';

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesTextViewer', () => {
  it('renders content lines', () => {
    render(<FilesTextViewer textContent={'line1\nline2\nline3'} textLines={3} textTruncated={false} />);
    expect(screen.getByText('line1')).toBeInTheDocument();
    expect(screen.getByText('line3')).toBeInTheDocument();
  });

  it('shows truncated indicator when truncated', () => {
    render(<FilesTextViewer textContent="x" textLines={1} textTruncated={true} />);
    expect(screen.getByText(/truncated/i)).toBeInTheDocument();
  });

  it('renders nothing when no textContent', () => {
    const { container } = render(<FilesTextViewer textContent={null} textLines={0} textTruncated={false} />);
    expect(container.querySelector('pre')).toBeNull();
  });
});
