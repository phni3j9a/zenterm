import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  gatewayUrl: string | null;
  isAuthenticated: () => boolean;
  login: (token: string, gatewayUrl: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      gatewayUrl: null,
      isAuthenticated: () => get().token !== null && get().gatewayUrl !== null,
      login: (token, gatewayUrl) => set({ token, gatewayUrl }),
      logout: () => set({ token: null, gatewayUrl: null }),
    }),
    {
      name: 'zenterm-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, gatewayUrl: state.gatewayUrl }),
    },
  ),
);
