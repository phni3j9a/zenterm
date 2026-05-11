import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { FilesMarkdownViewer } from '../FilesMarkdownViewer';

vi.setConfig({ testTimeout: 10_000 });

beforeAll(() => {
  useSettingsStore.setState({ language: 'en' });
  initI18n();
});

describe('FilesMarkdownViewer', () => {
  it('renders heading from markdown source', async () => {
    render(<FilesMarkdownViewer source={'# Hello World\n\nbody'} />);
    // react-markdown renders inside Suspense → wait for hydration
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hello World' })).toBeInTheDocument());
  });

  it('renders an empty container for empty source', async () => {
    const { container } = render(<FilesMarkdownViewer source="" />);
    await waitFor(() => expect(container.querySelector('[aria-label="Markdown preview"]')).toBeInTheDocument());
  });
});
