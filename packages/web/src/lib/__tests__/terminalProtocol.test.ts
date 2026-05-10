import { describe, expect, it } from 'vitest';
import { encodeInput, encodeResize, parseServerMessage } from '../terminalProtocol';

describe('terminalProtocol', () => {
  it('encodeInput returns JSON string', () => {
    expect(JSON.parse(encodeInput('ls\r'))).toEqual({ type: 'input', data: 'ls\r' });
  });

  it('encodeResize returns JSON string', () => {
    expect(JSON.parse(encodeResize(80, 24))).toEqual({ type: 'resize', cols: 80, rows: 24 });
  });

  it('parseServerMessage parses output', () => {
    const m = parseServerMessage('{"type":"output","data":"hello"}');
    expect(m).toEqual({ type: 'output', data: 'hello' });
  });

  it('parseServerMessage parses sessionInfo', () => {
    const m = parseServerMessage('{"type":"sessionInfo","session":{"name":"a","displayName":"a","created":1,"cwd":"/h"}}');
    expect(m?.type).toBe('sessionInfo');
  });

  it('parseServerMessage returns null for invalid JSON', () => {
    expect(parseServerMessage('not json')).toBeNull();
  });

  it('parseServerMessage returns null for unknown type', () => {
    expect(parseServerMessage('{"type":"xyz"}')).toBeNull();
  });
});
