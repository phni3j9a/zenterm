import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders sessions panel and bottom nav with 3 buttons', () => {
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
    expect(screen.getByRole('button', { name: /Sessions tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Files tab/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings tab/i })).not.toBeDisabled();
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
    expect(screen.getByLabelText(/Realtime updates/i)).toBeInTheDocument();
  });

  it('reflects connected status', () => {
    useEventsStore.setState({ status: 'connected', reconnectAttempt: 0, lastEvent: null });
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
    expect(screen.getByLabelText(/Realtime updates: connected/i)).toBeInTheDocument();
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

  it('marks Sessions tab pressed on /web/sessions', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    const sessionsTab = screen.getByRole('button', { name: /Sessions tab/i });
    expect(sessionsTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks Settings tab pressed on /web/settings', () => {
    render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    const settingsTab = screen.getByRole('button', { name: /Settings tab/i });
    expect(settingsTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('Settings tab click navigates to /web/settings', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Routes>
          <Route path="/web/*" element={<Sidebar {...baseProps} />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Settings tab/i }));
    const settingsTab = screen.getByRole('button', { name: /Settings tab/i });
    expect(settingsTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('Files tab is disabled with Phase 2c tooltip', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    const filesTab = screen.getByRole('button', { name: /Files tab/i });
    expect(filesTab).toBeDisabled();
    expect(filesTab.getAttribute('title')).toMatch(/Phase 2c/);
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
