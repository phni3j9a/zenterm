import { create } from 'zustand';
import type { TmuxSession } from '@zenterm/shared';
import * as api from '../api/client';
import { usePanesStore } from './panes';

interface SessionsState {
  sessions: TmuxSession[];
  activeSessionId: string | null;
  loading: boolean;
  error: string | null;
  openTabs: string[];
  bookmarked: Set<string>;
  fetchSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<TmuxSession>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newName: string) => Promise<void>;
  setActiveSession: (id: string) => void;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  toggleBookmark: (id: string) => void;
}

const BOOKMARKS_KEY = 'zenterm_bookmarks';

function loadBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveBookmarks(bookmarks: Set<string>) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarks]));
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,
  error: null,
  openTabs: [],
  bookmarked: loadBookmarks(),

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const sessions = await api.listSessions();
      set({ sessions, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createSession: async (name?: string) => {
    const session = await api.createSession(name);
    const { sessions } = get();
    set({ sessions: [...sessions, session] });
    get().openTab(session.name);
    get().setActiveSession(session.name);
    return session;
  },

  deleteSession: async (id: string) => {
    await api.deleteSession(id);
    const { sessions, openTabs, activeSessionId } = get();
    const filtered = sessions.filter((s) => s.name !== id);
    const filteredTabs = openTabs.filter((t) => t !== id);
    set({
      sessions: filtered,
      openTabs: filteredTabs,
      activeSessionId: activeSessionId === id ? (filteredTabs[0] ?? null) : activeSessionId,
    });
    // Sync pane state: close any panes with this session
    const panes = usePanesStore.getState();
    if (panes.root) {
      const collectLeaves = (node: import('./panes').PaneNode): import('./panes').LeafPane[] => {
        if (node.type === 'leaf') return [node];
        return [...collectLeaves(node.children[0]), ...collectLeaves(node.children[1])];
      };
      const leaves = collectLeaves(panes.root);
      for (const leaf of leaves) {
        if (leaf.sessionId === id) panes.closePane(leaf.paneId);
      }
    }
  },

  renameSession: async (id: string, newName: string) => {
    const renamed = await api.renameSession(id, newName);
    const { sessions, openTabs, activeSessionId } = get();
    set({
      sessions: sessions.map((s) => (s.name === id ? renamed : s)),
      openTabs: openTabs.map((t) => (t === id ? renamed.name : t)),
      activeSessionId: activeSessionId === id ? renamed.name : activeSessionId,
    });
  },

  setActiveSession: (id: string) => {
    set({ activeSessionId: id });
  },

  openTab: (id: string) => {
    const { openTabs } = get();
    if (!openTabs.includes(id)) {
      set({ openTabs: [...openTabs, id] });
    }
    set({ activeSessionId: id });
    // Initialize pane tree if needed
    const panes = usePanesStore.getState();
    if (!panes.root) {
      panes.openSession(id);
    }
  },

  closeTab: (id: string) => {
    const { openTabs, activeSessionId } = get();
    const filtered = openTabs.filter((t) => t !== id);
    set({
      openTabs: filtered,
      activeSessionId: activeSessionId === id ? (filtered[filtered.length - 1] ?? null) : activeSessionId,
    });
    // If no tabs left, clear pane tree
    if (filtered.length === 0) {
      usePanesStore.setState({ root: null, activePaneId: null });
    }
  },

  toggleBookmark: (id: string) => {
    const { bookmarked } = get();
    const next = new Set(bookmarked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    saveBookmarks(next);
    set({ bookmarked: next });
  },
}));
