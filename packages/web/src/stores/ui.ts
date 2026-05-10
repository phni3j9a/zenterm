import { create } from 'zustand';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export interface ToastEntry {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
  durationMs?: number;
}

interface UiState {
  confirmDialog: ConfirmDialogConfig | null;
  toasts: ToastEntry[];
  showConfirm: (cfg: ConfirmDialogConfig) => void;
  hideConfirm: () => void;
  pushToast: (toast: Omit<ToastEntry, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const MAX_TOASTS = 5;
let toastCounter = 0;

function nextToastId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}-${Date.now()}`;
}

export const useUiStore = create<UiState>((set) => ({
  confirmDialog: null,
  toasts: [],
  showConfirm: (cfg) => set({ confirmDialog: cfg }),
  hideConfirm: () => set({ confirmDialog: null }),
  pushToast: (toast) =>
    set((state) => {
      const next = [...state.toasts, { ...toast, id: nextToastId() }];
      const trimmed = next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      return { toasts: trimmed };
    }),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
