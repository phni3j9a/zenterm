import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 480;
export const SIDEBAR_WIDTH_DEFAULT = 320;

interface LayoutState {
  sidebarCollapsed: boolean;
  paletteOpen: boolean;
  layoutMenuOpen: boolean;
  searchOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  openLayoutMenu: () => void;
  closeLayoutMenu: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setSidebarWidth: (width: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      paletteOpen: false,
      layoutMenuOpen: false,
      searchOpen: false,
      sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      openPalette: () => set({ paletteOpen: true }),
      closePalette: () => set({ paletteOpen: false }),
      openLayoutMenu: () => set({ layoutMenuOpen: true }),
      closeLayoutMenu: () => set({ layoutMenuOpen: false }),
      openSearch: () => set({ searchOpen: true }),
      closeSearch: () => set({ searchOpen: false }),
      setSidebarWidth: (width) => {
        if (Number.isNaN(width)) return;
        set({ sidebarWidth: Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, Math.round(width))) });
      },
    }),
    {
      name: 'zenterm-web-layout',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
      }),
      migrate: (persistedState, version) => {
        const ps = (persistedState ?? {}) as Partial<LayoutState>;
        if (version < 2) {
          return { ...ps, sidebarWidth: SIDEBAR_WIDTH_DEFAULT } as unknown as LayoutState;
        }
        return ps as unknown as LayoutState;
      },
    },
  ),
);
