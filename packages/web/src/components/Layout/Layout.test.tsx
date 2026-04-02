import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';

vi.mock('./Header', () => ({
  Header: ({
    sidebarOpen,
    onToggleSidebar,
  }: {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
  }) => (
    <button onClick={onToggleSidebar}>
      {sidebarOpen ? 'Sidebar open' : 'Sidebar closed'}
    </button>
  ),
}));

vi.mock('./Sidebar', () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

vi.mock('./StatusBar', () => ({
  StatusBar: () => <div>StatusBar</div>,
}));

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches,
      media: '(max-width: 768px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('Layout', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the main layout test id', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('toggles the sidebar open state from the header control', () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    const body = screen.getByTestId('main-layout').querySelector('[data-sidebar-open]');
    expect(body).toHaveAttribute('data-sidebar-open', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Sidebar open' }));

    expect(body).toHaveAttribute('data-sidebar-open', 'false');
  });

  it('starts with the sidebar closed on narrow screens', () => {
    mockMatchMedia(true);
    render(
      <Layout>
        <div>Content</div>
      </Layout>,
    );

    const body = screen.getByTestId('main-layout').querySelector('[data-sidebar-open]');
    expect(body).toHaveAttribute('data-sidebar-open', 'false');
  });
});
