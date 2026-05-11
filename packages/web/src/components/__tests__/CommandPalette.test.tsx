import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';
import { useLayoutStore } from '@/stores/layout';
import { useSessionsStore } from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { usePaneStore } from '@/stores/pane';

describe('CommandPalette', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      paletteOpen: false,
      sidebarCollapsed: false,
      layoutMenuOpen: false,
      searchOpen: false,
    });
    useSessionsStore.setState({ sessions: [], loading: false, error: null } as never);
    useSettingsStore.setState({ themeMode: 'system' } as never);
    usePaneStore.setState({
      layout: 'single',
      panes: [null, null, null, null],
      focusedIndex: 0,
      ratios: { single: [], 'cols-2': [0.5], 'cols-3': [0.5, 0.5], 'grid-2x2': [0.5], 'main-side-2': [0.6, 0.5] },
      savedLayout: null,
    } as never);
  });

  it('renders nothing when paletteOpen is false', () => {
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows actions when opened and filters by query', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'theme');
    const items = screen.getAllByRole('option');
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(it.textContent?.toLowerCase()).toContain('theme');
  });

  it('Enter runs the highlighted action and closes the palette', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    await user.type(screen.getByRole('combobox'), 'dark theme');
    await user.keyboard('{Enter}');
    expect(useSettingsStore.getState().themeMode).toBe('dark');
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
  });

  it('Escape closes the palette without running anything', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    await user.keyboard('{Escape}');
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
  });

  it('"jump:" actions call paneStore.openInFocusedPane', async () => {
    useSessionsStore.setState({
      sessions: [{
        displayName: 'zztop',
        name: 'zen_zztop',
        created: 0,
        cwd: '/',
        windows: [{ index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/' }],
      }],
      loading: false, error: null,
    } as never);
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    await user.type(screen.getByRole('combobox'), 'zztop');
    await user.keyboard('{Enter}');
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'zztop', windowIndex: 0 });
  });
});
