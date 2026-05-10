import { describe, expect, it } from 'vitest';
import { createReconnectBackoff } from '../reconnectBackoff';

describe('createReconnectBackoff', () => {
  it('starts at 1000ms', () => {
    const b = createReconnectBackoff();
    expect(b.next()).toEqual({ delayMs: 1000, attempt: 1, exhausted: false });
  });

  it('doubles each attempt up to 30000ms cap', () => {
    const b = createReconnectBackoff();
    expect(b.next().delayMs).toBe(1000);
    expect(b.next().delayMs).toBe(2000);
    expect(b.next().delayMs).toBe(4000);
    expect(b.next().delayMs).toBe(8000);
    expect(b.next().delayMs).toBe(16000);
    expect(b.next().delayMs).toBe(30000);
    expect(b.next().delayMs).toBe(30000);
  });

  it('exhausted after 20 attempts', () => {
    const b = createReconnectBackoff();
    let lastResult = b.next();
    for (let i = 0; i < 19; i++) lastResult = b.next();
    expect(lastResult.attempt).toBe(20);
    expect(lastResult.exhausted).toBe(false);
    const beyond = b.next();
    expect(beyond.exhausted).toBe(true);
  });

  it('reset() restarts from initial', () => {
    const b = createReconnectBackoff();
    b.next();
    b.next();
    b.reset();
    expect(b.next().delayMs).toBe(1000);
  });
});
