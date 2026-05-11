import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LayoutSelector } from '../LayoutSelector';
import { useLayoutStore } from '@/stores/layout';

describe('LayoutSelector external open', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarCollapsed: false, paletteOpen: false, layoutMenuOpen: false });
  });
  it('opens the menu when useLayoutStore.layoutMenuOpen flips to true', () => {
    render(<LayoutSelector />);
    expect(screen.queryByRole('menuitemradio', { name: /single/i })).toBeNull();
    act(() => useLayoutStore.getState().openLayoutMenu());
    expect(screen.getByRole('menuitemradio', { name: /single/i })).toBeInTheDocument();
  });
});
