import { describe, it, expect } from 'vitest';
import { encode, decode } from '@/lib/paneStateFragment';
import type { LayoutMode } from '../paneLayout';

describe('paneStateFragment encode', () => {
  it('encodes single layout with 1 terminal pane', () => {
    const result = encode({
      layout: 'single' as LayoutMode,
      panes: [{ kind: 'terminal', sessionId: 'work', windowIndex: 0 }],
    });
    expect(result).toBe('l=single&p=t:work.0');
  });

  it('encodes cols-2 with 1 terminal + 1 empty', () => {
    const result = encode({
      layout: 'cols-2' as LayoutMode,
      panes: [{ kind: 'terminal', sessionId: 'work', windowIndex: 0 }, null],
    });
    expect(result).toBe('l=cols-2&p=t:work.0,_');
  });

  it('encodes grid-2x2 with 4 panes', () => {
    const result = encode({
      layout: 'grid-2x2' as LayoutMode,
      panes: [
        { kind: 'terminal', sessionId: 'a', windowIndex: 0 },
        { kind: 'terminal', sessionId: 'b', windowIndex: 2 },
        { kind: 'terminal', sessionId: 'c', windowIndex: 0 },
        null,
      ],
    });
    expect(result).toBe('l=grid-2x2&p=t:a.0,t:b.2,t:c.0,_');
  });

  it('percent-encodes session ids with special chars', () => {
    const result = encode({
      layout: 'single' as LayoutMode,
      panes: [{ kind: 'terminal', sessionId: 'my session', windowIndex: 0 }],
    });
    expect(result).toBe('l=single&p=t:my%20session.0');
  });

  it('encodes file pane with f: prefix', () => {
    const result = encode({
      layout: 'single' as LayoutMode,
      panes: [{ kind: 'file', path: '/tmp/foo.txt' }],
    });
    expect(result).toBe('l=single&p=f:%2Ftmp%2Ffoo.txt');
  });
});

describe('paneStateFragment decode', () => {
  it('decodes valid hash with leading #', () => {
    expect(decode('#l=cols-2&p=t:work.0,t:dev.1')).toEqual({
      layout: 'cols-2',
      panes: [
        { kind: 'terminal', sessionId: 'work', windowIndex: 0 },
        { kind: 'terminal', sessionId: 'dev', windowIndex: 1 },
      ],
    });
  });

  it('decodes valid hash without leading #', () => {
    expect(decode('l=single&p=t:work.0')).toEqual({
      layout: 'single',
      panes: [{ kind: 'terminal', sessionId: 'work', windowIndex: 0 }],
    });
  });

  it('decodes empty slots as null', () => {
    expect(decode('l=grid-2x2&p=t:a.0,_,t:c.0,_')).toEqual({
      layout: 'grid-2x2',
      panes: [
        { kind: 'terminal', sessionId: 'a', windowIndex: 0 },
        null,
        { kind: 'terminal', sessionId: 'c', windowIndex: 0 },
        null,
      ],
    });
  });

  it('returns null for unknown layout', () => {
    expect(decode('l=unknown&p=t:x.0')).toBeNull();
  });

  it('returns null for mismatched slot count', () => {
    expect(decode('l=cols-2&p=t:a.0,t:b.0,t:c.0')).toBeNull();
  });

  it('returns null for malformed percent encoding', () => {
    expect(decode('l=single&p=t:%2.0')).toBeNull();
  });

  it('returns null for non-numeric windowIndex', () => {
    expect(decode('l=single&p=t:work.abc')).toBeNull();
  });

  it('returns null for missing p= param', () => {
    expect(decode('l=single')).toBeNull();
  });
});

describe('paneStateFragment v3 (kind aware)', () => {
  it('terminal/file/null 混在を round-trip する', () => {
    const state = {
      layout: 'cols-2' as const,
      panes: [
        { kind: 'terminal' as const, sessionId: 'sess A', windowIndex: 3 },
        { kind: 'file' as const, path: '/tmp/foo bar.txt' },
      ],
    };
    const out = decode('#' + encode(state));
    expect(out).toEqual(state);
  });

  it('legacy ハッシュ(prefix なし)を terminal 補完で decode できる', () => {
    // 旧フォーマット: <encodeURIComponent(sid)>.<idx>
    const legacy = `#l=cols-2&p=demo.0,_`;
    const out = decode(legacy);
    expect(out).toEqual({
      layout: 'cols-2',
      panes: [
        { kind: 'terminal', sessionId: 'demo', windowIndex: 0 },
        null,
      ],
    });
  });

  it('file パスに `,` と `:` が含まれてもエンコード/デコードできる', () => {
    const state = {
      layout: 'single' as const,
      panes: [{ kind: 'file' as const, path: '/a,b:c.txt' }],
    };
    const out = decode('#' + encode(state));
    expect(out).toEqual(state);
  });
});
