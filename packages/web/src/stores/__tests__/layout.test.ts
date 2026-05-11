import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../layout';

describe('useLayoutStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({
      sidebarCollapsed: false,
      paletteOpen: false,
      layoutMenuOpen: false,
    });
  });

  it('has sane defaults', () => {
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(false);
  });

  it('toggles sidebarCollapsed', () => {
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
  });

  it('opens and closes the palette', () => {
    useLayoutStore.getState().openPalette();
    expect(useLayoutStore.getState().paletteOpen).toBe(true);
    useLayoutStore.getState().closePalette();
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
  });

  it('opens and closes the layout menu', () => {
    useLayoutStore.getState().openLayoutMenu();
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(true);
    useLayoutStore.getState().closeLayoutMenu();
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(false);
  });

  it('persists sidebarCollapsed only (not transient open flags)', () => {
    useLayoutStore.getState().toggleSidebar();
    useLayoutStore.getState().openPalette();
    const raw = localStorage.getItem('zenterm-web-layout');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> };
    expect(parsed.state.sidebarCollapsed).toBe(true);
    expect(parsed.state.paletteOpen).toBeUndefined();
    expect(parsed.state.layoutMenuOpen).toBeUndefined();
  });
});
