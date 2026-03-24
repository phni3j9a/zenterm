import { create } from 'zustand';

interface AuthState {
  token: string | null;
  gatewayUrl: string;
  setAuth: (token: string, gatewayUrl?: string) => void;
  logout: () => void;
}

const STORAGE_KEY = 'zenterm_auth';

function loadAuth(): { token: string | null; gatewayUrl: string } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { token: parsed.token ?? null, gatewayUrl: parsed.gatewayUrl ?? '' };
    }
  } catch { /* ignore */ }
  return { token: null, gatewayUrl: '' };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadAuth(),
  setAuth: (token, gatewayUrl) =>
    set((state) => {
      const url = gatewayUrl ?? state.gatewayUrl;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, gatewayUrl: url }));
      return { token, gatewayUrl: url };
    }),
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, gatewayUrl: '' });
  },
}));
