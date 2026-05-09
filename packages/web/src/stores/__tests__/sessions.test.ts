import { describe, expect, it, beforeEach } from 'vitest';
import type { TmuxSession } from '@zenterm/shared';
import { useSessionsStore } from '../sessions';

const sampleSession = (name: string): TmuxSession => ({
  name,
  displayName: name,
  created: 1,
  cwd: '/home',
  windows: [],
});

describe('useSessionsStore', () => {
  beforeEach(() => {
    useSessionsStore.setState({ sessions: [], loading: false, error: null });
  });

  it('setSessions replaces the list', () => {
    useSessionsStore.getState().setSessions([sampleSession('a'), sampleSession('b')]);
    expect(useSessionsStore.getState().sessions.map((s) => s.name)).toEqual(['a', 'b']);
  });

  it('upsert adds new and updates existing by name', () => {
    useSessionsStore.getState().setSessions([sampleSession('a')]);
    useSessionsStore.getState().upsert(sampleSession('b'));
    expect(useSessionsStore.getState().sessions).toHaveLength(2);
    useSessionsStore.getState().upsert({ ...sampleSession('a'), cwd: '/new' });
    expect(useSessionsStore.getState().sessions.find((s) => s.name === 'a')?.cwd).toBe('/new');
  });

  it('remove drops session by name', () => {
    useSessionsStore.getState().setSessions([sampleSession('a'), sampleSession('b')]);
    useSessionsStore.getState().remove('a');
    expect(useSessionsStore.getState().sessions.map((s) => s.name)).toEqual(['b']);
  });
});
