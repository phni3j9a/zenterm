import { create } from 'zustand';

// ─── Types ───

export type SplitDirection = 'horizontal' | 'vertical';

export interface LeafPane {
  type: 'leaf';
  paneId: string;
  sessionId: string;
}

export interface SplitPane {
  type: 'split';
  direction: SplitDirection;
  ratio: number;
  children: [PaneNode, PaneNode];
}

export type PaneNode = LeafPane | SplitPane;

interface PanesState {
  root: PaneNode | null;
  activePaneId: string | null;
  /** Open a single session (resets layout to single leaf) */
  openSession: (sessionId: string) => void;
  /** Split the active pane, placing a new session in the new half */
  splitPane: (direction: SplitDirection, newSessionId: string) => void;
  /** Close a pane by id, collapsing the split */
  closePane: (paneId: string) => void;
  /** Resize a split by updating the ratio of the parent containing the pane */
  resizePane: (paneId: string, delta: number) => void;
  /** Set focus to a pane */
  setActivePane: (paneId: string) => void;
  /** Replace the session in a pane */
  setPaneSession: (paneId: string, sessionId: string) => void;
  /** Get session ID of active pane */
  getActiveSessionId: () => string | null;
  /** Restore layout from localStorage */
  restoreLayout: (availableSessionIds: string[]) => void;
}

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;
const LAYOUT_STORAGE_KEY = 'zenterm_pane_layout';

let nextPaneId = 1;
function genPaneId(): string {
  return `pane-${nextPaneId++}`;
}

function clampRatio(r: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

// ─── Persistence ───

function getMaxPaneId(node: PaneNode): number {
  if (node.type === 'leaf') {
    const match = node.paneId.match(/^pane-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }
  return Math.max(getMaxPaneId(node.children[0]), getMaxPaneId(node.children[1]));
}

function saveLayout(root: PaneNode | null, activePaneId: string | null): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ root, activePaneId }));
  } catch { /* ignore */ }
}

function loadLayout(): { root: PaneNode | null; activePaneId: string | null } | null {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

function filterTree(node: PaneNode, validIds: Set<string>): PaneNode | null {
  if (node.type === 'leaf') {
    return validIds.has(node.sessionId) ? node : null;
  }
  const left = filterTree(node.children[0], validIds);
  const right = filterTree(node.children[1], validIds);
  if (!left) return right;
  if (!right) return left;
  return { ...node, children: [left, right] };
}

// ─── Tree operations ───

function findLeaf(node: PaneNode, paneId: string): LeafPane | null {
  if (node.type === 'leaf') return node.paneId === paneId ? node : null;
  return findLeaf(node.children[0], paneId) ?? findLeaf(node.children[1], paneId);
}

function splitLeaf(
  node: PaneNode,
  targetPaneId: string,
  direction: SplitDirection,
  newLeaf: LeafPane,
): PaneNode {
  if (node.type === 'leaf') {
    if (node.paneId === targetPaneId) {
      return {
        type: 'split',
        direction,
        ratio: 0.5,
        children: [node, newLeaf],
      };
    }
    return node;
  }
  return {
    ...node,
    children: [
      splitLeaf(node.children[0], targetPaneId, direction, newLeaf),
      splitLeaf(node.children[1], targetPaneId, direction, newLeaf),
    ],
  };
}

function removeLeaf(node: PaneNode, paneId: string): PaneNode | null {
  if (node.type === 'leaf') return node.paneId === paneId ? null : node;
  const left = removeLeaf(node.children[0], paneId);
  const right = removeLeaf(node.children[1], paneId);
  if (!left) return right;
  if (!right) return left;
  return { ...node, children: [left, right] };
}

function findParentSplit(
  node: PaneNode,
  paneId: string,
): { split: SplitPane; index: 0 | 1 } | null {
  if (node.type === 'leaf') return null;
  for (const idx of [0, 1] as const) {
    const child = node.children[idx];
    if (child.type === 'leaf' && child.paneId === paneId) {
      return { split: node, index: idx };
    }
    const deeper = findParentSplit(child, paneId);
    if (deeper) return deeper;
  }
  return null;
}

function updateParentRatio(
  node: PaneNode,
  paneId: string,
  delta: number,
): PaneNode {
  if (node.type === 'leaf') return node;
  for (const idx of [0, 1] as const) {
    const child = node.children[idx];
    if (child.type === 'leaf' && child.paneId === paneId) {
      const sign = idx === 0 ? 1 : -1;
      return { ...node, ratio: clampRatio(node.ratio + delta * sign) };
    }
  }
  return {
    ...node,
    children: [
      updateParentRatio(node.children[0], paneId, delta),
      updateParentRatio(node.children[1], paneId, delta),
    ],
  };
}

function getFirstLeaf(node: PaneNode): LeafPane {
  if (node.type === 'leaf') return node;
  return getFirstLeaf(node.children[0]);
}

function collectLeaves(node: PaneNode): LeafPane[] {
  if (node.type === 'leaf') return [node];
  return [...collectLeaves(node.children[0]), ...collectLeaves(node.children[1])];
}

// ─── Store ───

export const usePanesStore = create<PanesState>((set, get) => ({
  root: null,
  activePaneId: null,

  openSession: (sessionId) => {
    const paneId = genPaneId();
    const { root } = get();
    if (!root) {
      const newRoot: LeafPane = { type: 'leaf', paneId, sessionId };
      set({ root: newRoot, activePaneId: paneId });
      saveLayout(newRoot, paneId);
      return;
    }
    // If a leaf with this session already exists, just focus it
    const leaves = collectLeaves(root);
    const existing = leaves.find((l) => l.sessionId === sessionId);
    if (existing) {
      set({ activePaneId: existing.paneId });
      saveLayout(root, existing.paneId);
      return;
    }
    // Otherwise add as new leaf (split active pane horizontally)
    const { activePaneId } = get();
    if (activePaneId) {
      const newLeaf: LeafPane = { type: 'leaf', paneId, sessionId };
      const newRoot = splitLeaf(root, activePaneId, 'horizontal', newLeaf);
      set({ root: newRoot, activePaneId: paneId });
      saveLayout(newRoot, paneId);
    }
  },

  splitPane: (direction, newSessionId) => {
    const { root, activePaneId } = get();
    if (!root || !activePaneId) return;
    const newPaneId = genPaneId();
    const newLeaf: LeafPane = { type: 'leaf', paneId: newPaneId, sessionId: newSessionId };
    const newRoot = splitLeaf(root, activePaneId, direction, newLeaf);
    set({ root: newRoot, activePaneId: newPaneId });
    saveLayout(newRoot, newPaneId);
  },

  closePane: (paneId) => {
    const { root, activePaneId } = get();
    if (!root) return;
    const newRoot = removeLeaf(root, paneId);
    if (!newRoot) {
      set({ root: null, activePaneId: null });
      saveLayout(null, null);
      return;
    }
    const wasActive = activePaneId === paneId;
    const newActive = wasActive ? getFirstLeaf(newRoot).paneId : activePaneId;
    set({ root: newRoot, activePaneId: newActive });
    saveLayout(newRoot, newActive);
  },

  resizePane: (paneId, delta) => {
    const { root } = get();
    if (!root) return;
    const newRoot = updateParentRatio(root, paneId, delta);
    set({ root: newRoot });
    saveLayout(newRoot, get().activePaneId);
  },

  setActivePane: (paneId) => {
    set({ activePaneId: paneId });
    saveLayout(get().root, paneId);
  },

  setPaneSession: (paneId, sessionId) => {
    const { root } = get();
    if (!root) return;
    const updateSession = (node: PaneNode): PaneNode => {
      if (node.type === 'leaf') {
        return node.paneId === paneId ? { ...node, sessionId } : node;
      }
      return {
        ...node,
        children: [updateSession(node.children[0]), updateSession(node.children[1])],
      };
    };
    const newRoot = updateSession(root);
    set({ root: newRoot });
    saveLayout(newRoot, get().activePaneId);
  },

  getActiveSessionId: () => {
    const { root, activePaneId } = get();
    if (!root || !activePaneId) return null;
    const leaf = findLeaf(root, activePaneId);
    return leaf?.sessionId ?? null;
  },

  restoreLayout: (availableSessionIds) => {
    const saved = loadLayout();
    if (!saved?.root) return;
    const validIds = new Set(availableSessionIds);
    const filtered = filterTree(saved.root, validIds);
    if (!filtered) return;
    // Rehydrate nextPaneId to avoid collisions
    const maxId = getMaxPaneId(filtered);
    if (maxId >= nextPaneId) nextPaneId = maxId + 1;
    const activePaneId = saved.activePaneId && findLeaf(filtered, saved.activePaneId)
      ? saved.activePaneId
      : getFirstLeaf(filtered).paneId;
    set({ root: filtered, activePaneId });
  },
}));
