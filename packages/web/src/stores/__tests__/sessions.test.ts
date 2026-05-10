import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { TmuxSession } from '@zenterm/shared';
import { useSessionsStore } from '../sessions';
import { useSessionViewStore } from '../sessionView';

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
    useSessionViewStore.setState({ activeSessionId: null, activeWindowIndex: null });
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

  it('refetch sets loading and replaces sessions on success', async () => {
    const sessions = [sampleSession('a'), sampleSession('b')];
    const fetchMock = vi.fn().mockResolvedValue(sessions);
    const apiClientFactory = () => ({ listSessions: fetchMock } as unknown as { listSessions: () => Promise<TmuxSession[]> });
    const promise = useSessionsStore.getState().refetch(apiClientFactory());
    expect(useSessionsStore.getState().loading).toBe(true);
    await promise;
    expect(useSessionsStore.getState().loading).toBe(false);
    expect(useSessionsStore.getState().sessions.map((s) => s.name)).toEqual(['a', 'b']);
    expect(useSessionsStore.getState().error).toBeNull();
  });

  it('refetch records error on failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    const apiClient = { listSessions: fetchMock } as unknown as { listSessions: () => Promise<TmuxSession[]> };
    await useSessionsStore.getState().refetch(apiClient);
    expect(useSessionsStore.getState().loading).toBe(false);
    expect(useSessionsStore.getState().error).toBe('boom');
  });

  it('createSession calls API and upserts result', async () => {
    const created: TmuxSession = sampleSession('new');
    const client = {
      createSession: vi.fn().mockResolvedValue(created),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['create']>[0];
    const result = await useSessionsStore.getState().create(client, { name: 'new' });
    expect(result).toEqual(created);
    expect(useSessionsStore.getState().sessions).toContainEqual(created);
  });

  it('renameSession replaces session in store', async () => {
    useSessionsStore.getState().setSessions([sampleSession('a')]);
    const renamed = { ...sampleSession('a'), displayName: 'renamed' };
    const client = {
      renameSession: vi.fn().mockResolvedValue(renamed),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['rename']>[0];
    const result = await useSessionsStore.getState().rename(client, 'a', 'renamed');
    expect(result.displayName).toBe('renamed');
    expect(useSessionsStore.getState().sessions[0].displayName).toBe('renamed');
  });

  it('removeSession drops session from store', async () => {
    useSessionsStore.getState().setSessions([sampleSession('a'), sampleSession('b')]);
    const client = {
      killSession: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['removeSession']>[0];
    await useSessionsStore.getState().removeSession(client, 'a');
    expect(useSessionsStore.getState().sessions.map((s) => s.name)).toEqual(['b']);
  });

  it('removeSession switches active session to next when removing the active one', async () => {
    useSessionsStore.getState().setSessions([sampleSession('a'), sampleSession('b')]);
    useSessionViewStore.getState().open('a', 0);
    const client = {
      killSession: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['removeSession']>[0];
    await useSessionsStore.getState().removeSession(client, 'a');
    expect(useSessionViewStore.getState().activeSessionId).toBe('b');
  });

  it('removeSession clears view when no sessions remain', async () => {
    useSessionsStore.getState().setSessions([sampleSession('a')]);
    useSessionViewStore.getState().open('a', 0);
    const client = {
      killSession: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['removeSession']>[0];
    await useSessionsStore.getState().removeSession(client, 'a');
    expect(useSessionViewStore.getState().activeSessionId).toBeNull();
  });

  it('createWindow refetches sessions on success', async () => {
    const updated = [{ ...sampleSession('a'), windows: [{ index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' }] }];
    const client = {
      createWindow: vi.fn().mockResolvedValue({ index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' }),
      listSessions: vi.fn().mockResolvedValue(updated),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['createWindow']>[0];
    await useSessionsStore.getState().createWindow(client, 'a', { name: 'w0' });
    expect(client.createWindow).toHaveBeenCalledWith('a', { name: 'w0' });
    expect(client.listSessions).toHaveBeenCalled();
    expect(useSessionsStore.getState().sessions).toEqual(updated);
  });

  it('renameWindow refetches sessions on success', async () => {
    const updated = [{ ...sampleSession('a'), windows: [{ index: 0, name: 'renamed', active: true, zoomed: false, paneCount: 1, cwd: '/' }] }];
    const client = {
      renameWindow: vi.fn().mockResolvedValue({ index: 0, name: 'renamed', active: true, zoomed: false, paneCount: 1, cwd: '/' }),
      listSessions: vi.fn().mockResolvedValue(updated),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['renameWindow']>[0];
    await useSessionsStore.getState().renameWindow(client, 'a', 0, 'renamed');
    expect(client.renameWindow).toHaveBeenCalledWith('a', 0, { name: 'renamed' });
  });

  it('removeWindow refetches and falls back to next window when removing active', async () => {
    useSessionsStore.getState().setSessions([
      {
        ...sampleSession('a'),
        windows: [
          { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
          { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
        ],
      },
    ]);
    useSessionViewStore.getState().open('a', 0);
    const client = {
      killWindow: vi.fn().mockResolvedValue({ ok: true }),
      listSessions: vi.fn().mockResolvedValue([
        {
          ...sampleSession('a'),
          windows: [{ index: 1, name: 'w1', active: true, zoomed: false, paneCount: 1, cwd: '/' }],
        },
      ]),
    } as unknown as Parameters<ReturnType<typeof useSessionsStore.getState>['removeWindow']>[0];
    await useSessionsStore.getState().removeWindow(client, 'a', 0);
    expect(useSessionViewStore.getState().activeWindowIndex).toBe(1);
  });
});
