import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../layout';

describe('useLayoutStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({
      sidebarCollapsed: false,
      paletteOpen: false,
      layoutMenuOpen: false,
      searchOpen: false,
      sidebarWidth: 320,
    });
  });

  it('has sane defaults', () => {
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(false);
    expect(useLayoutStore.getState().searchOpen).toBe(false);
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

  it('opens and closes search', () => {
    useLayoutStore.getState().openSearch();
    expect(useLayoutStore.getState().searchOpen).toBe(true);
    useLayoutStore.getState().closeSearch();
    expect(useLayoutStore.getState().searchOpen).toBe(false);
  });

  it('persists sidebarCollapsed and sidebarWidth (not transient open flags)', () => {
    useLayoutStore.getState().toggleSidebar();
    useLayoutStore.getState().setSidebarWidth(400);
    useLayoutStore.getState().openPalette();
    const raw = localStorage.getItem('zenterm-web-layout');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> };
    expect(parsed.state.sidebarCollapsed).toBe(true);
    expect(parsed.state.sidebarWidth).toBe(400);
    expect(parsed.state.paletteOpen).toBeUndefined();
    expect(parsed.state.layoutMenuOpen).toBeUndefined();
    expect(parsed.state.searchOpen).toBeUndefined();
  });

  describe('sidebarWidth', () => {
    beforeEach(() => {
      useLayoutStore.setState({ sidebarWidth: 320 });
    });

    it('defaults to 320', () => {
      expect(useLayoutStore.getState().sidebarWidth).toBe(320);
    });

    it('setSidebarWidth clamps to 240..480', () => {
      useLayoutStore.getState().setSidebarWidth(100);
      expect(useLayoutStore.getState().sidebarWidth).toBe(240);
      useLayoutStore.getState().setSidebarWidth(600);
      expect(useLayoutStore.getState().sidebarWidth).toBe(480);
      useLayoutStore.getState().setSidebarWidth(350);
      expect(useLayoutStore.getState().sidebarWidth).toBe(350);
    });

    it('setSidebarWidth ignores NaN, clamps Infinity to max', () => {
      useLayoutStore.getState().setSidebarWidth(300);
      useLayoutStore.getState().setSidebarWidth(NaN);
      expect(useLayoutStore.getState().sidebarWidth).toBe(300);
      useLayoutStore.getState().setSidebarWidth(Infinity);
      expect(useLayoutStore.getState().sidebarWidth).toBe(480);
    });

    it('rounds fractional widths', () => {
      useLayoutStore.getState().setSidebarWidth(350.6);
      expect(useLayoutStore.getState().sidebarWidth).toBe(351);
    });
  });
});
