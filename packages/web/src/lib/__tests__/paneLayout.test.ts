import { describe, it, expect } from 'vitest';
import {
  LAYOUT_MODES,
  SLOT_COUNT,
  SPLITTER_COUNT,
  DEFAULT_RATIOS,
  clampRatio,
  dropExtraPanes,
  upgradeLayout,
} from '../paneLayout';

describe('paneLayout constants', () => {
  it('LAYOUT_MODES は 5 種すべてを含む', () => {
    expect(LAYOUT_MODES).toEqual(['single', 'cols-2', 'cols-3', 'grid-2x2', 'main-side-2']);
  });

  it('SLOT_COUNT は仕様通り 1/2/3/4/3', () => {
    expect(SLOT_COUNT.single).toBe(1);
    expect(SLOT_COUNT['cols-2']).toBe(2);
    expect(SLOT_COUNT['cols-3']).toBe(3);
    expect(SLOT_COUNT['grid-2x2']).toBe(4);
    expect(SLOT_COUNT['main-side-2']).toBe(3);
  });

  it('SPLITTER_COUNT は仕様通り 0/1/2/2/2', () => {
    expect(SPLITTER_COUNT.single).toBe(0);
    expect(SPLITTER_COUNT['cols-2']).toBe(1);
    expect(SPLITTER_COUNT['cols-3']).toBe(2);
    expect(SPLITTER_COUNT['grid-2x2']).toBe(2);
    expect(SPLITTER_COUNT['main-side-2']).toBe(2);
  });

  it('DEFAULT_RATIOS は各レイアウトの SPLITTER_COUNT と一致する長さ', () => {
    expect(DEFAULT_RATIOS.single.length).toBe(0);
    expect(DEFAULT_RATIOS['cols-2'].length).toBe(1);
    expect(DEFAULT_RATIOS['cols-3'].length).toBe(2);
    expect(DEFAULT_RATIOS['grid-2x2'].length).toBe(2);
    expect(DEFAULT_RATIOS['main-side-2'].length).toBe(2);
  });

  it('DEFAULT_RATIOS の各要素は 0.1〜0.9 の範囲', () => {
    for (const mode of LAYOUT_MODES) {
      for (const r of DEFAULT_RATIOS[mode]) {
        expect(r).toBeGreaterThanOrEqual(0.1);
        expect(r).toBeLessThanOrEqual(0.9);
      }
    }
  });
});

describe('clampRatio', () => {
  it('範囲内はそのまま返す', () => {
    expect(clampRatio(0.5)).toBe(0.5);
    expect(clampRatio(0.25)).toBe(0.25);
  });
  it('下限 0.1 でクランプ', () => {
    expect(clampRatio(0)).toBe(0.1);
    expect(clampRatio(-0.5)).toBe(0.1);
    expect(clampRatio(0.05)).toBe(0.1);
  });
  it('上限 0.9 でクランプ', () => {
    expect(clampRatio(1)).toBe(0.9);
    expect(clampRatio(0.95)).toBe(0.9);
  });
  it('NaN は 0.5 で fallback', () => {
    expect(clampRatio(NaN)).toBe(0.5);
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
    // grid-2x2 (4) → cols-2 (2)。focused=3 (d) を残し、a を 0 番に詰める
    const result = dropExtraPanes(panes, 3, 2);
    expect(result.panes.length).toBe(2);
    expect(result.panes[0]).toEqual({ sessionId: 'd', windowIndex: 0 });
    // 残り 1 枠に最初の非 focused (a) が入る
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
  it('main-side-2 → null (custom layout, no upgrade)', () => expect(upgradeLayout('main-side-2')).toBeNull());
});
