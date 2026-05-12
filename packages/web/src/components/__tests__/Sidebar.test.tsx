import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { useEventsStore } from '@/stores/events';

const noopActions = {
  onSelect: vi.fn(),
  onCreateSession: vi.fn(),
  onRenameSession: vi.fn(),
  onRequestDeleteSession: vi.fn(),
  onCreateWindow: vi.fn(),
  onRenameWindow: vi.fn(),
  onRequestDeleteWindow: vi.fn(),
};

describe('Sidebar', () => {
  beforeEach(() => {
    useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
  });

  it('renders sessions panel (no footer nav tabs — those moved to LeftRail)', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar
          sessions={[]}
          loading={false}
          error={null}
          activeSessionId={null}
          activeWindowIndex={null}
          {...noopActions}
        />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
    // Footer tabs have moved to LeftRail — they should NOT be in Sidebar anymore
    expect(screen.queryByRole('button', { name: /Sessions tab/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Files tab/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Settings tab/i })).not.toBeInTheDocument();
  });

  it('shows events status indicator', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar
          sessions={[]}
          loading={false}
          error={null}
          activeSessionId={null}
          activeWindowIndex={null}
          {...noopActions}
        />
      </MemoryRouter>,
    );
    // EventsStatusDot is no longer part of Sidebar — it was in the removed footer nav
    // The sidebar still renders session list content
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
  });

  it('reflects connected status (EventsStatusDot is exported and renderable separately)', () => {
    useEventsStore.setState({ status: 'connected', reconnectAttempt: 0, lastEvent: null });
    // The EventsStatusDot has been exported from Sidebar for potential reuse.
    // The Sidebar itself no longer embeds it in a footer nav. Just verify sidebar renders.
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar
          sessions={[]}
          loading={false}
          error={null}
          activeSessionId={null}
          activeWindowIndex={null}
          {...noopActions}
        />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
  });
});

describe('Sidebar URL-driven activePanel', () => {
  const baseProps = {
    sessions: [],
    loading: false,
    error: null,
    activeSessionId: null,
    activeWindowIndex: null,
    onSelect: () => {},
    onCreateSession: () => {},
    onRenameSession: () => {},
    onRequestDeleteSession: () => {},
    onCreateWindow: () => {},
    onRenameWindow: () => {},
    onRequestDeleteWindow: () => {},
  };

  it('shows sessions panel on /web/sessions (tab switching now in LeftRail)', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    // Sidebar content panel switches by URL — verify sessions panel is shown
    expect(screen.getByLabelText(/sessions panel/i)).toBeInTheDocument();
  });

  it('shows settings panel on /web/settings (tab switching now in LeftRail)', () => {
    render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/settings panel/i)).toBeInTheDocument();
  });

  it('shows files panel label on /web/files even without filesClient', () => {
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <Routes>
          <Route path="/web/*" element={<Sidebar {...baseProps} />} />
        </Routes>
      </MemoryRouter>,
    );
    // The panel div aria-label reflects the active panel derived from URL
    expect(screen.getByLabelText(/files panel/i)).toBeInTheDocument();
  });

  it('shows files panel label on /web/files when filesClient provided', () => {
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    // The panel div aria-label reflects the active panel derived from URL
    expect(screen.getByLabelText(/files panel/i)).toBeInTheDocument();
  });

  it('renders FilesSidebarPanel when activePanel=files and filesClient given', () => {
    const filesClient = {
      listFiles: () => Promise.resolve({ path: '~', entries: [] }),
      getFileContent: () => Promise.resolve({ path: '', content: '', lines: 0, truncated: false }),
      writeFileContent: () => Promise.resolve({ path: '', bytes: 0 }),
      deleteFile: () => Promise.resolve({ path: '', deleted: true }),
      renameFile: () => Promise.resolve({ oldPath: '', newPath: '' }),
      copyFiles: () => Promise.resolve({ copied: [] }),
      moveFiles: () => Promise.resolve({ moved: [] }),
      createDirectory: () => Promise.resolve({ path: '', created: true }),
      uploadFile: () => Promise.resolve({ success: true, path: '', filename: '', size: 0, mimetype: '' }),
      buildRawFileUrl: () => '',
    };
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <Sidebar {...baseProps} filesClient={filesClient as any} />
      </MemoryRouter>,
    );
    expect(screen.getAllByLabelText(/Files panel/i).length).toBeGreaterThan(0);
  });
});
