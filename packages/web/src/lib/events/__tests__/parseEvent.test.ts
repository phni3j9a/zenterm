import { describe, expect, it } from 'vitest';
import { parseEvent } from '../parseEvent';

describe('parseEvent', () => {
  it('parses sessions-changed', () => {
    expect(parseEvent('{"type":"sessions-changed"}')).toEqual({ type: 'sessions-changed' });
  });

  it('parses windows-changed', () => {
    expect(parseEvent('{"type":"windows-changed"}')).toEqual({ type: 'windows-changed' });
  });

  it('parses monitor-restart', () => {
    expect(parseEvent('{"type":"monitor-restart"}')).toEqual({ type: 'monitor-restart' });
  });

  it('returns null for unknown type', () => {
    expect(parseEvent('{"type":"foo"}')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseEvent('not-json')).toBeNull();
  });

  it('returns null for missing type', () => {
    expect(parseEvent('{"data":"x"}')).toBeNull();
  });

  it('ignores extra fields', () => {
    expect(parseEvent('{"type":"sessions-changed","extra":"x"}')).toEqual({
      type: 'sessions-changed',
    });
  });
});
