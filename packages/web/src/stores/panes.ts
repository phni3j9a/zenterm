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
}

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

let nextPaneId = 1;
function genPaneId(): string {
  return `pane-${nextPaneId++}`;
}

function clampRatio(r: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
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
      set({ root: { type: 'leaf', paneId, sessionId }, activePaneId: paneId });
      return;
    }
    // If a leaf with this session already exists, just focus it
    const leaves = collectLeaves(root);
    const existing = leaves.find((l) => l.sessionId === sessionId);
    if (existing) {
      set({ activePaneId: existing.paneId });
      return;
    }
    // Otherwise add as new leaf (split active pane horizontally)
    const { activePaneId } = get();
    if (activePaneId) {
      const newLeaf: LeafPane = { type: 'leaf', paneId, sessionId };
      set({
        root: splitLeaf(root, activePaneId, 'horizontal', newLeaf),
        activePaneId: paneId,
      });
    }
  },

  splitPane: (direction, newSessionId) => {
    const { root, activePaneId } = get();
    if (!root || !activePaneId) return;
    const newPaneId = genPaneId();
    const newLeaf: LeafPane = { type: 'leaf', paneId: newPaneId, sessionId: newSessionId };
    set({
      root: splitLeaf(root, activePaneId, direction, newLeaf),
      activePaneId: newPaneId,
    });
  },

  closePane: (paneId) => {
    const { root, activePaneId } = get();
    if (!root) return;
    const newRoot = removeLeaf(root, paneId);
    if (!newRoot) {
      set({ root: null, activePaneId: null });
      return;
    }
    const wasActive = activePaneId === paneId;
    const newActive = wasActive ? getFirstLeaf(newRoot).paneId : activePaneId;
    set({ root: newRoot, activePaneId: newActive });
  },

  resizePane: (paneId, delta) => {
    const { root } = get();
    if (!root) return;
    set({ root: updateParentRatio(root, paneId, delta) });
  },

  setActivePane: (paneId) => {
    set({ activePaneId: paneId });
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
    set({ root: updateSession(root) });
  },

  getActiveSessionId: () => {
    const { root, activePaneId } = get();
    if (!root || !activePaneId) return null;
    const leaf = findLeaf(root, activePaneId);
    return leaf?.sessionId ?? null;
  },
}));
