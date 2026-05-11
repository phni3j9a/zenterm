import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { useLayoutStore } from '@/stores/layout';

function renderSidebar(collapsed: boolean) {
  useLayoutStore.setState({ sidebarCollapsed: collapsed });
  return render(
    <MemoryRouter initialEntries={['/web/sessions']}>
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        onSelect={() => undefined}
        onCreateSession={() => undefined}
        onRenameSession={() => undefined}
        onRequestDeleteSession={() => undefined}
        onCreateWindow={() => undefined}
        onRenameWindow={() => undefined}
        onRequestDeleteWindow={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('Sidebar collapse', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarCollapsed: false });
  });

  it('renders at full width when not collapsed', () => {
    renderSidebar(false);
    const aside = screen.getByRole('complementary');
    expect(aside.getAttribute('aria-hidden')).not.toBe('true');
    const style = window.getComputedStyle(aside);
    expect(parseInt(style.width, 10)).toBeGreaterThan(0);
  });

  it('hides itself when collapsed', () => {
    renderSidebar(true);
    const aside = screen.getByRole('complementary', { hidden: true });
    expect(aside).toHaveAttribute('aria-hidden', 'true');
    const style = window.getComputedStyle(aside);
    expect(parseInt(style.width, 10)).toBe(0);
  });
});
