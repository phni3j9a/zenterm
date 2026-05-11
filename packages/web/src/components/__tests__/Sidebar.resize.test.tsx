import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { useLayoutStore } from '@/stores/layout';

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/web/sessions']}>
      <Sidebar
        sessions={[]} loading={false} error={null}
        activeSessionId={null} activeWindowIndex={null}
        onSelect={() => undefined} onCreateSession={() => undefined}
        onRenameSession={() => undefined} onRequestDeleteSession={() => undefined}
        onCreateWindow={() => undefined} onRenameWindow={() => undefined}
        onRequestDeleteWindow={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('Sidebar width / resizer', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarCollapsed: false, sidebarWidth: 320 });
  });

  it('renders at store sidebarWidth when not collapsed', () => {
    useLayoutStore.setState({ sidebarWidth: 400 });
    renderSidebar();
    const aside = screen.getByRole('complementary');
    expect(aside.style.width).toBe('400px');
  });

  it('renders SidebarResizer when not collapsed', () => {
    renderSidebar();
    expect(screen.getByRole('separator', { name: /resize|サイドバー幅/i })).toBeInTheDocument();
  });

  it('does not render SidebarResizer when collapsed', () => {
    useLayoutStore.setState({ sidebarCollapsed: true });
    renderSidebar();
    // 折りたたみ時は aside 内が空になるので queryByRole で null
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('aside has position relative for resizer anchoring', () => {
    renderSidebar();
    const aside = screen.getByRole('complementary');
    expect(aside.style.position).toBe('relative');
  });
});
