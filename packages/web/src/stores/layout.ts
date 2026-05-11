import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface LayoutState {
  sidebarCollapsed: boolean;
  paletteOpen: boolean;
  layoutMenuOpen: boolean;
  searchOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  openLayoutMenu: () => void;
  closeLayoutMenu: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      paletteOpen: false,
      layoutMenuOpen: false,
      searchOpen: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      openPalette: () => set({ paletteOpen: true }),
      closePalette: () => set({ paletteOpen: false }),
      openLayoutMenu: () => set({ layoutMenuOpen: true }),
      closeLayoutMenu: () => set({ layoutMenuOpen: false }),
      openSearch: () => set({ searchOpen: true }),
      closeSearch: () => set({ searchOpen: false }),
    }),
    {
      name: 'zenterm-web-layout',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
