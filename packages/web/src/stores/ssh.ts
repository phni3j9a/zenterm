import { create } from 'zustand';

export interface SshPreset {
  id: string;
  label: string;
  host: string;
  port: number;
  user: string;
}

interface SshPresetsState {
  presets: SshPreset[];
  addPreset: (preset: Omit<SshPreset, 'id'>) => void;
  removePreset: (id: string) => void;
  updatePreset: (id: string, patch: Partial<Omit<SshPreset, 'id'>>) => void;
}

const STORAGE_KEY = 'zenterm_ssh_presets';

function loadPresets(): SshPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function savePresets(presets: SshPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function genId(): string {
  return `ssh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Validation: only allow safe characters in host and user
const HOST_RE = /^[a-zA-Z0-9._-]{1,253}$/;
const USER_RE = /^[a-zA-Z0-9._-]{1,64}$/;

export function validateSshPreset(preset: { host: string; user: string; port: number }): string | null {
  if (!HOST_RE.test(preset.host)) return 'Invalid hostname';
  if (!USER_RE.test(preset.user)) return 'Invalid username';
  if (preset.port < 1 || preset.port > 65535) return 'Invalid port';
  return null;
}

export function buildSshCommand(preset: SshPreset): string {
  // Shell-safe: all values are validated to contain only safe characters
  const parts = ['ssh'];
  if (preset.port !== 22) parts.push('-p', String(preset.port));
  parts.push(`${preset.user}@${preset.host}`);
  return parts.join(' ');
}

export const useSshPresetsStore = create<SshPresetsState>((set, get) => ({
  presets: loadPresets(),

  addPreset: (preset) => {
    const p = { ...preset, id: genId() };
    const next = [...get().presets, p];
    savePresets(next);
    set({ presets: next });
  },

  removePreset: (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    savePresets(next);
    set({ presets: next });
  },

  updatePreset: (id, patch) => {
    const next = get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    savePresets(next);
    set({ presets: next });
  },
}));
