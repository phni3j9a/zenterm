import { describe, it, expect, beforeEach } from 'vitest';
import { usePaneStore } from '../pane';
import { SLOT_COUNT } from '@/lib/paneLayout';

const target = (id: string, w = 0) =>
  ({ kind: 'terminal', sessionId: id, windowIndex: w }) as const;

beforeEach(() => {
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    savedLayout: null,
  });
});

describe('paneStore initial state', () => {
  it('初期値は single レイアウト + 1 pane null + focus 0', () => {
    const s = usePaneStore.getState();
    expect(s.layout).toBe('single');
    expect(s.panes).toEqual([null]);
    expect(s.focusedIndex).toBe(0);
  });
});

describe('setLayout', () => {
  it('cols-2 へ切替で panes 長が 2 に拡張、focus は保持', () => {
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().setLayout('cols-2');
    const s = usePaneStore.getState();
    expect(s.layout).toBe('cols-2');
    expect(s.panes.length).toBe(2);
    expect(s.panes[0]).toEqual(target('a'));
    expect(s.panes[1]).toBe(null);
    expect(s.focusedIndex).toBe(0);
  });

  it('grid-2x2 (4) → single (1) で focused を残し他は捨てる', () => {
    usePaneStore.getState().setLayout('grid-2x2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(1, target('b'));
    usePaneStore.getState().assignPane(2, target('c'));
    usePaneStore.getState().assignPane(3, target('d'));
    usePaneStore.getState().setFocusedIndex(2);
    usePaneStore.getState().setLayout('single');
    const s = usePaneStore.getState();
    expect(s.layout).toBe('single');
    expect(s.panes).toEqual([target('c')]);
    expect(s.focusedIndex).toBe(0);
  });

  it('同じ layout へ setLayout してもクラッシュしない', () => {
    usePaneStore.getState().setLayout('single');
    expect(() => usePaneStore.getState().setLayout('single')).not.toThrow();
  });
});

describe('assignPane', () => {
  it('idx に target を入れる', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(1, target('z'));
    expect(usePaneStore.getState().panes[1]).toEqual(target('z'));
  });

  it('null クリア可能', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(0, null);
    expect(usePaneStore.getState().panes[0]).toBe(null);
  });

  it('範囲外 idx は no-op', () => {
    const before = usePaneStore.getState().panes;
    usePaneStore.getState().assignPane(99, target('z'));
    expect(usePaneStore.getState().panes).toEqual(before);
  });
});

describe('openInFocusedPane', () => {
  it('focused idx に target を置く', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().setFocusedIndex(1);
    usePaneStore.getState().openInFocusedPane(target('a'));
    expect(usePaneStore.getState().panes[1]).toEqual(target('a'));
  });
});

describe('isOccupied', () => {
  it('別 idx で同 (s,w) があれば true', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    expect(usePaneStore.getState().isOccupied(target('a'))).toBe(true);
  });

  it('excludeIdx で除外指定すれば自分の slot は無視', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    expect(usePaneStore.getState().isOccupied(target('a'), 0)).toBe(false);
  });

  it('window index 違いは別物扱い', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a', 0));
    expect(usePaneStore.getState().isOccupied(target('a', 1))).toBe(false);
  });

  it('isOccupied は file kind に対しては常に false', () => {
    const s = usePaneStore.getState();
    s.setLayout('cols-2');
    s.assignPane(0, { kind: 'file', path: '/a' });
    expect(s.isOccupied({ kind: 'file', path: '/a' })).toBe(false);
  });
});

describe('suspendForSingle / resume', () => {
  it('現 layout を savedLayout に退避し single に切替', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(1, target('b'));
    usePaneStore.getState().setFocusedIndex(1);

    usePaneStore.getState().suspendForSingle();
    const s = usePaneStore.getState();
    expect(s.layout).toBe('single');
    expect(s.savedLayout).toBe('cols-2');
    expect(s.panes).toEqual([target('b')]);
  });

  it('savedLayout を resume で復元', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(1, target('b'));
    usePaneStore.getState().setFocusedIndex(1);
    usePaneStore.getState().suspendForSingle();
    usePaneStore.getState().resume();
    const s = usePaneStore.getState();
    expect(s.layout).toBe('cols-2');
    expect(s.savedLayout).toBe(null);
    expect(s.panes.length).toBe(2);
  });

  it('savedLayout が null の場合 resume は no-op', () => {
    usePaneStore.getState().setLayout('single');
    usePaneStore.getState().resume();
    expect(usePaneStore.getState().layout).toBe('single');
    expect(usePaneStore.getState().savedLayout).toBe(null);
  });

  it('既に single のとき suspendForSingle は savedLayout を更新しない', () => {
    usePaneStore.getState().setLayout('single');
    usePaneStore.getState().suspendForSingle();
    expect(usePaneStore.getState().savedLayout).toBe(null);
  });
});

describe('persist round-trip', () => {
  it('panes / layout が localStorage に書かれる', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    const raw = window.localStorage.getItem('zenterm-web-pane');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.layout).toBe('cols-2');
    expect(parsed.state.panes[0]).toEqual(target('a'));
    expect(parsed.state.ratios).toBeUndefined();
  });
});

describe('SLOT_COUNT contract', () => {
  it('setLayout 後の panes.length は SLOT_COUNT に一致', () => {
    for (const mode of ['single', 'cols-2', 'cols-3', 'grid-2x2'] as const) {
      usePaneStore.getState().setLayout(mode);
      expect(usePaneStore.getState().panes.length).toBe(SLOT_COUNT[mode]);
    }
  });
});

describe('persist hydration', () => {
  it('v1 永続化データ (ratios 付き) を migrate で v2 に変換し ratios を捨てる', async () => {
    window.localStorage.setItem(
      'zenterm-web-pane',
      JSON.stringify({
        state: {
          layout: 'grid-2x2',
          panes: [
            { sessionId: 'x', windowIndex: 0 },
            null,
            { sessionId: 'y', windowIndex: 1 },
            null,
          ],
          focusedIndex: 2,
          ratios: {
            single: [],
            'cols-2': [0.5],
            'cols-3': [1 / 3, 0.5],
            'grid-2x2': [0.42, 0.58],
            'main-side-2': [0.6, 0.5],
          },
          savedLayout: null,
        },
        version: 1,
      }),
    );
    await usePaneStore.persist.rehydrate();
    const s = usePaneStore.getState();
    expect(s.layout).toBe('grid-2x2');
    expect(s.panes).toEqual([
      { sessionId: 'x', windowIndex: 0 },
      null,
      { sessionId: 'y', windowIndex: 1 },
      null,
    ]);
    expect(s.focusedIndex).toBe(2);
    expect((s as unknown as { ratios?: unknown }).ratios).toBeUndefined();
  });

  it('v1 永続化データで layout が削除済の main-side-2 なら single にフォールバック', async () => {
    window.localStorage.setItem(
      'zenterm-web-pane',
      JSON.stringify({
        state: {
          layout: 'main-side-2',
          panes: [null, null, null],
          focusedIndex: 0,
          ratios: {},
          savedLayout: null,
        },
        version: 1,
      }),
    );
    await usePaneStore.persist.rehydrate();
    const s = usePaneStore.getState();
    expect(s.layout).toBe('single');
  });

  it('migrate fills missing fields with defaults', async () => {
    window.localStorage.setItem(
      'zenterm-web-pane',
      JSON.stringify({
        state: {
          layout: 'cols-2',
          panes: [null, null],
        },
        version: 1,
      }),
    );
    await usePaneStore.persist.rehydrate();
    const s = usePaneStore.getState();
    expect(s.layout).toBe('cols-2');
    expect(s.focusedIndex).toBe(0);
    expect(s.savedLayout).toBeNull();
  });
});

describe('PaneTarget kind discrimination', () => {
  it('terminal ターゲットを assign できる', () => {
    const s = usePaneStore.getState();
    s.assignPane(0, { kind: 'terminal', sessionId: 'demo', windowIndex: 0 });
    expect(usePaneStore.getState().panes[0]).toEqual({
      kind: 'terminal',
      sessionId: 'demo',
      windowIndex: 0,
    });
  });

  it('file ターゲットを assign できる', () => {
    const s = usePaneStore.getState();
    s.assignPane(0, { kind: 'file', path: '/tmp/a.txt' });
    expect(usePaneStore.getState().panes[0]).toEqual({
      kind: 'file',
      path: '/tmp/a.txt',
    });
  });
});
