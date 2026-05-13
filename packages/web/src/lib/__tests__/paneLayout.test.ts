import { describe, it, expect } from 'vitest';
import {
  LAYOUT_MODES,
  SLOT_COUNT,
  dropExtraPanes,
  upgradeLayout,
} from '../paneLayout';

describe('paneLayout constants', () => {
  it('LAYOUT_MODES は 4 種 (single / cols-2 / cols-3 / grid-2x2)', () => {
    expect(LAYOUT_MODES).toEqual(['single', 'cols-2', 'cols-3', 'grid-2x2']);
  });

  it('SLOT_COUNT は仕様通り 1/2/3/4', () => {
    expect(SLOT_COUNT.single).toBe(1);
    expect(SLOT_COUNT['cols-2']).toBe(2);
    expect(SLOT_COUNT['cols-3']).toBe(3);
    expect(SLOT_COUNT['grid-2x2']).toBe(4);
  });
});

describe('dropExtraPanes', () => {
  it('focusedIndex を最優先で残し、残り slot を埋める', () => {
    const panes = [
      { sessionId: 'a', windowIndex: 0 },
      { sessionId: 'b', windowIndex: 0 },
      { sessionId: 'c', windowIndex: 0 },
      { sessionId: 'd', windowIndex: 0 },
    ];
    const result = dropExtraPanes(panes, /* focusedIndex */ 2, /* nextCount */ 1);
    expect(result.panes).toEqual([{ sessionId: 'c', windowIndex: 0 }]);
    expect(result.focusedIndex).toBe(0);
  });

  it('縮小時に focused 以外の前方 pane を新スロットに詰め直す', () => {
    const panes = [
      { sessionId: 'a', windowIndex: 0 },
      { sessionId: 'b', windowIndex: 0 },
      { sessionId: 'c', windowIndex: 0 },
      { sessionId: 'd', windowIndex: 0 },
    ];
    const result = dropExtraPanes(panes, 3, 2);
    expect(result.panes.length).toBe(2);
    expect(result.panes[0]).toEqual({ sessionId: 'd', windowIndex: 0 });
    expect(result.panes[1]).toEqual({ sessionId: 'a', windowIndex: 0 });
    expect(result.focusedIndex).toBe(0);
  });

  it('拡張時は null で埋める', () => {
    const panes = [{ sessionId: 'a', windowIndex: 0 }];
    const result = dropExtraPanes(panes, 0, 3);
    expect(result.panes).toEqual([
      { sessionId: 'a', windowIndex: 0 },
      null,
      null,
    ]);
    expect(result.focusedIndex).toBe(0);
  });

  it('focusedIndex が範囲外の場合 0 にクランプ', () => {
    const panes = [{ sessionId: 'a', windowIndex: 0 }, null];
    const result = dropExtraPanes(panes, 5, 2);
    expect(result.focusedIndex).toBe(0);
  });

  it('nextCount が負数のとき空配列を返す', () => {
    const panes = [{ sessionId: 'a', windowIndex: 0 }];
    const result = dropExtraPanes(panes, 0, -1);
    expect(result.panes).toEqual([]);
    expect(result.focusedIndex).toBe(0);
  });

  it('nextCount=0 で空配列を返し focus は 0', () => {
    const panes = [{ sessionId: 'a', windowIndex: 0 }, { sessionId: 'b', windowIndex: 0 }];
    const result = dropExtraPanes(panes, 1, 0);
    expect(result.panes).toEqual([]);
    expect(result.focusedIndex).toBe(0);
  });
});

describe('upgradeLayout', () => {
  it('single → cols-2', () => expect(upgradeLayout('single')).toBe('cols-2'));
  it('cols-2 → cols-3', () => expect(upgradeLayout('cols-2')).toBe('cols-3'));
  it('cols-3 → grid-2x2', () => expect(upgradeLayout('cols-3')).toBe('grid-2x2'));
  it('grid-2x2 → null (at max)', () => expect(upgradeLayout('grid-2x2')).toBeNull());
});
