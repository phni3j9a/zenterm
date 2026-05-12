import { describe, it, expect } from 'vitest';
import { encode, decode } from '../paneStateFragment';
import type { LayoutMode } from '../paneLayout';

describe('paneStateFragment encode', () => {
  it('encodes single layout with 1 pane', () => {
    const result = encode({
      layout: 'single' as LayoutMode,
      panes: [{ sessionId: 'work', windowIndex: 0 }],
    });
    expect(result).toBe('l=single&p=work.0');
  });

  it('encodes cols-2 with 1 occupied + 1 empty', () => {
    const result = encode({
      layout: 'cols-2' as LayoutMode,
      panes: [{ sessionId: 'work', windowIndex: 0 }, null],
    });
    expect(result).toBe('l=cols-2&p=work.0,_');
  });

  it('encodes grid-2x2 with 4 panes', () => {
    const result = encode({
      layout: 'grid-2x2' as LayoutMode,
      panes: [
        { sessionId: 'a', windowIndex: 0 },
        { sessionId: 'b', windowIndex: 2 },
        { sessionId: 'c', windowIndex: 0 },
        null,
      ],
    });
    expect(result).toBe('l=grid-2x2&p=a.0,b.2,c.0,_');
  });

  it('percent-encodes session ids with special chars', () => {
    const result = encode({
      layout: 'single' as LayoutMode,
      panes: [{ sessionId: 'my session', windowIndex: 0 }],
    });
    expect(result).toBe('l=single&p=my%20session.0');
  });
});

describe('paneStateFragment decode', () => {
  it('decodes valid hash with leading #', () => {
    expect(decode('#l=cols-2&p=work.0,dev.1')).toEqual({
      layout: 'cols-2',
      panes: [
        { sessionId: 'work', windowIndex: 0 },
        { sessionId: 'dev', windowIndex: 1 },
      ],
    });
  });

  it('decodes valid hash without leading #', () => {
    expect(decode('l=single&p=work.0')).toEqual({
      layout: 'single',
      panes: [{ sessionId: 'work', windowIndex: 0 }],
    });
  });

  it('decodes empty slots as null', () => {
    expect(decode('l=grid-2x2&p=a.0,_,c.0,_')).toEqual({
      layout: 'grid-2x2',
      panes: [
        { sessionId: 'a', windowIndex: 0 },
        null,
        { sessionId: 'c', windowIndex: 0 },
        null,
      ],
    });
  });

  it('returns null for unknown layout', () => {
    expect(decode('l=unknown&p=x.0')).toBeNull();
  });

  it('returns null for mismatched slot count', () => {
    expect(decode('l=cols-2&p=a.0,b.0,c.0')).toBeNull();
  });

  it('returns null for malformed percent encoding', () => {
    expect(decode('l=single&p=%2.0')).toBeNull();
  });

  it('returns null for non-numeric windowIndex', () => {
    expect(decode('l=single&p=work.abc')).toBeNull();
  });

  it('returns null for missing p= param', () => {
    expect(decode('l=single')).toBeNull();
  });

  it('round-trips encode→decode', () => {
    const state = {
      layout: 'cols-3' as LayoutMode,
      panes: [
        { sessionId: 'one', windowIndex: 0 },
        null,
        { sessionId: 'two', windowIndex: 3 },
      ],
    };
    const encoded = encode(state);
    expect(decode(encoded)).toEqual(state);
  });
});
