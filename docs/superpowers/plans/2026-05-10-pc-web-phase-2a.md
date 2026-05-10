# PC Web Phase 2a (events + Sidebar CRUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 (Bootstrap) の上に events 購読・session/window CRUD・Sidebar 完成を載せ、機能パリティ単一ペインの基盤を完成させる。

**Architecture:** zustand ストア (`sessions` 拡張 + 新規 `events` / `ui`) を中心に、API mutation のレスポンスで即時反映 + `/ws/events` で外部変更を refetch backup。UI は自前実装の `<dialog>`-based ConfirmDialog / InlineEdit / RowActionsMenu / Toast を導入し、SessionsListPanel を SessionRow + WindowRow + 周辺ボタンに分割。

**Tech Stack:** TypeScript 5.7 / React 19 / Vite 6 / zustand 5 / vitest 4 / React Testing Library / Playwright 1.58 (Phase 1 から不変、追加依存なし)

**Spec:** `docs/superpowers/specs/2026-05-10-pc-web-phase-2a-design.md`

**Branch:** `feature/web-pc-design-spec` (Phase 1 と同ブランチを継続。完了時 tag `web-pc-phase-2a-done`)

---

## Sub-Phase 2a-1: Foundation (events 基盤)

### Task 1: Move TmuxEvent type from gateway to shared

**Files:**
- Modify: `packages/shared/src/index.ts` (add TmuxEvent export)
- Modify: `packages/gateway/src/services/tmuxControl.ts` (replace local definition with import)
- Modify: `packages/gateway/src/routes/events.ts` (update import path)
- Test: 既存 `packages/gateway/src/__tests__/services/tmuxControl.test.ts` が通り続ける

- [ ] **Step 1: Add TmuxEvent to shared**

Append to `packages/shared/src/index.ts` before the trailing `export * from './tokens';` line:

```ts
/**
 * tmux 制御モード由来のイベント。Gateway が `/ws/events` で配信し、
 * クライアント (web / app) が一覧の refetch トリガとして利用する。
 *
 * - `sessions-changed`: session の追加/削除/rename
 * - `windows-changed`: window の追加/削除/rename/layout 変更
 * - `monitor-restart`: 監視 tmux サーバーが再接続した (refetch 推奨)
 */
export type TmuxEvent =
  | { type: 'sessions-changed' }
  | { type: 'windows-changed' }
  | { type: 'monitor-restart' };
```

- [ ] **Step 2: Update gateway to import from shared**

In `packages/gateway/src/services/tmuxControl.ts`, replace lines 7-10:

```ts
export type TmuxEvent =
  | { type: 'sessions-changed' }
  | { type: 'windows-changed' }
  | { type: 'monitor-restart' };
```

with:

```ts
import type { TmuxEvent } from '@zenterm/shared';
export type { TmuxEvent };
```

`re-export` する理由: `tmuxControl.ts` の他の箇所 (`Listener`, `parseControlLine`, `emit`) や、`routes/events.ts` の import 形式 (`import { tmuxControlService, type TmuxEvent } from '../services/tmuxControl.js';`) を変更せずに済むため。

- [ ] **Step 3: Run gateway tests to verify migration**

Run: `npm test -w packages/gateway -- tmuxControl`
Expected: PASS (既存テストが TmuxEvent 移管後も通る)

Run: `npm run build -w packages/gateway`
Expected: SUCCESS (型エラーなし)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/index.ts packages/gateway/src/services/tmuxControl.ts
git commit -m "$(cat <<'EOF'
refactor(shared): move TmuxEvent type from gateway to shared

Phase 2a で web client が /ws/events を購読するため、TmuxEvent を共通型に移管。
gateway 側は再 export で互換性を維持。
EOF
)"
```

---

### Task 2: Add events store

**Files:**
- Create: `packages/web/src/stores/events.ts`
- Test: `packages/web/src/stores/__tests__/events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/stores/__tests__/events.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useEventsStore } from '../events';

describe('useEventsStore', () => {
  beforeEach(() => {
    useEventsStore.setState({
      status: 'idle',
      reconnectAttempt: 0,
      lastEvent: null,
    });
  });

  it('starts in idle status with no event', () => {
    const s = useEventsStore.getState();
    expect(s.status).toBe('idle');
    expect(s.reconnectAttempt).toBe(0);
    expect(s.lastEvent).toBeNull();
  });

  it('setStatus updates status', () => {
    useEventsStore.getState().setStatus('connected');
    expect(useEventsStore.getState().status).toBe('connected');
  });

  it('setReconnectAttempt updates attempt count', () => {
    useEventsStore.getState().setReconnectAttempt(5);
    expect(useEventsStore.getState().reconnectAttempt).toBe(5);
  });

  it('setLastEvent records most recent event', () => {
    useEventsStore.getState().setLastEvent({ type: 'sessions-changed' });
    expect(useEventsStore.getState().lastEvent).toEqual({ type: 'sessions-changed' });
    useEventsStore.getState().setLastEvent({ type: 'windows-changed' });
    expect(useEventsStore.getState().lastEvent).toEqual({ type: 'windows-changed' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w packages/web -- events`
Expected: FAIL with `Cannot find module '../events'`

- [ ] **Step 3: Implement events store**

Create `packages/web/src/stores/events.ts`:

```ts
import { create } from 'zustand';
import type { TmuxEvent } from '@zenterm/shared';

export type EventsStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface EventsState {
  status: EventsStatus;
  reconnectAttempt: number;
  lastEvent: TmuxEvent | null;
  setStatus: (status: EventsStatus) => void;
  setReconnectAttempt: (attempt: number) => void;
  setLastEvent: (event: TmuxEvent) => void;
}

export const useEventsStore = create<EventsState>((set) => ({
  status: 'idle',
  reconnectAttempt: 0,
  lastEvent: null,
  setStatus: (status) => set({ status }),
  setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt }),
  setLastEvent: (lastEvent) => set({ lastEvent }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w packages/web -- events`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/events.ts packages/web/src/stores/__tests__/events.test.ts
git commit -m "feat(web): add events store (status / reconnectAttempt / lastEvent)"
```

---

### Task 3: Add events/parseEvent helper

**Files:**
- Create: `packages/web/src/lib/events/parseEvent.ts`
- Test: `packages/web/src/lib/events/__tests__/parseEvent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/lib/events/__tests__/parseEvent.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w packages/web -- parseEvent`
Expected: FAIL with `Cannot find module '../parseEvent'`

- [ ] **Step 3: Implement parseEvent**

Create `packages/web/src/lib/events/parseEvent.ts`:

```ts
import type { TmuxEvent } from '@zenterm/shared';

const VALID_TYPES = new Set<TmuxEvent['type']>([
  'sessions-changed',
  'windows-changed',
  'monitor-restart',
]);

export function parseEvent(raw: string): TmuxEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    typeof (parsed as { type: unknown }).type !== 'string'
  ) {
    return null;
  }
  const type = (parsed as { type: string }).type as TmuxEvent['type'];
  if (!VALID_TYPES.has(type)) return null;
  return { type };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w packages/web -- parseEvent`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/events/
git commit -m "feat(web): add events/parseEvent helper for /ws/events messages"
```

---

### Task 4: Add TmuxEventsClient

**Files:**
- Create: `packages/web/src/lib/events/client.ts`
- Test: `packages/web/src/lib/events/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/lib/events/__tests__/client.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TmuxEventsClient } from '../client';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  closeMock = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  close(_code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.closeMock(_code);
    this.onclose?.({ code: _code ?? 1000 });
  }
  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  triggerMessage(data: string) {
    this.onmessage?.({ data });
  }
  triggerClose(code: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }
}

describe('TmuxEventsClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens WebSocket and reports connecting → connected', () => {
    const onStatusChange = vi.fn();
    const onEvent = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent,
      onStatusChange,
    });
    client.start();
    expect(onStatusChange).toHaveBeenCalledWith('connecting', 0);
    MockWebSocket.instances[0].triggerOpen();
    expect(onStatusChange).toHaveBeenCalledWith('connected', 0);
  });

  it('parses incoming messages and forwards via onEvent', () => {
    const onEvent = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent,
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerMessage('{"type":"sessions-changed"}');
    expect(onEvent).toHaveBeenCalledWith({ type: 'sessions-changed' });
  });

  it('ignores unparsable messages', () => {
    const onEvent = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent,
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerMessage('garbage');
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('reconnects on abnormal close (1006) with backoff', () => {
    const onStatusChange = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange,
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerClose(1006);
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting', 1);
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('does NOT reconnect on 1000 (normal close)', () => {
    const onStatusChange = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange,
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerClose(1000);
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('does NOT reconnect on 1008 (auth fail)', () => {
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerClose(1008);
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('stop() closes socket with 1000 and prevents reconnect', () => {
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    client.stop();
    expect(MockWebSocket.instances[0].closeMock).toHaveBeenCalledWith(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w packages/web -- events/client`
Expected: FAIL with `Cannot find module '../client'`

- [ ] **Step 3: Implement TmuxEventsClient**

Create `packages/web/src/lib/events/client.ts`:

```ts
import type { TmuxEvent } from '@zenterm/shared';
import { createReconnectBackoff, type ReconnectBackoff } from '@/lib/reconnectBackoff';
import { parseEvent } from './parseEvent';
import type { EventsStatus } from '@/stores/events';

export interface TmuxEventsClientOptions {
  url: string;
  onEvent: (event: TmuxEvent) => void;
  onStatusChange: (status: EventsStatus, attempt: number) => void;
}

export class TmuxEventsClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private backoff: ReconnectBackoff = createReconnectBackoff();
  private stopped = false;

  constructor(private readonly options: TmuxEventsClientOptions) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close(1000);
      this.socket = null;
    }
  }

  triggerReconnect(): void {
    this.backoff.reset();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close(1000);
      this.socket = null;
    }
    if (!this.stopped) this.connect();
  }

  private connect(): void {
    if (this.stopped) return;
    this.options.onStatusChange('connecting', 0);
    const ws = new WebSocket(this.options.url);
    this.socket = ws;

    ws.onopen = () => {
      if (this.stopped) return;
      this.backoff.reset();
      this.options.onStatusChange('connected', 0);
    };

    ws.onmessage = (ev) => {
      if (this.stopped) return;
      const raw = typeof ev.data === 'string' ? ev.data : '';
      const event = parseEvent(raw);
      if (event) this.options.onEvent(event);
    };

    ws.onclose = (ev) => {
      this.socket = null;
      if (this.stopped) return;
      if (ev.code === 1000 || ev.code === 1008) {
        this.options.onStatusChange('idle', 0);
        return;
      }
      const step = this.backoff.next();
      if (step.exhausted) {
        this.options.onStatusChange('failed', step.attempt);
        return;
      }
      this.options.onStatusChange('reconnecting', step.attempt);
      this.reconnectTimer = window.setTimeout(() => this.connect(), step.delayMs);
    };

    ws.onerror = () => {
      // close ハンドラで実際の reconnect を行うので、ここでは何もしない。
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w packages/web -- events/client`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/events/client.ts packages/web/src/lib/events/__tests__/client.test.ts
git commit -m "feat(web): add TmuxEventsClient (WS + reconnect backoff)"
```

---

### Task 5: Add useEventsSubscription hook

**Files:**
- Create: `packages/web/src/hooks/useEventsSubscription.ts`
- Test: `packages/web/src/hooks/__tests__/useEventsSubscription.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/hooks/__tests__/useEventsSubscription.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventsSubscription } from '../useEventsSubscription';
import { useEventsStore } from '@/stores/events';
import { useSessionsStore } from '@/stores/sessions';
import { useAuthStore } from '@/stores/auth';

const startMock = vi.fn();
const stopMock = vi.fn();
let lastOptions: { onEvent: (e: unknown) => void; onStatusChange: (s: string, a: number) => void } | null = null;

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function (this: unknown, options: typeof lastOptions) {
    lastOptions = options;
    return { start: startMock, stop: stopMock, triggerReconnect: vi.fn() };
  }),
}));

describe('useEventsSubscription', () => {
  beforeEach(() => {
    startMock.mockReset();
    stopMock.mockReset();
    lastOptions = null;
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
    useSessionsStore.setState({ sessions: [], loading: false, error: null });
    useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts client on mount and stops on unmount', () => {
    const { unmount } = renderHook(() => useEventsSubscription());
    expect(startMock).toHaveBeenCalledOnce();
    unmount();
    expect(stopMock).toHaveBeenCalledOnce();
  });

  it('does not start when token is missing', () => {
    useAuthStore.setState({ token: null, gatewayUrl: null });
    renderHook(() => useEventsSubscription());
    expect(startMock).not.toHaveBeenCalled();
  });

  it('updates events store on status change', () => {
    renderHook(() => useEventsSubscription());
    act(() => lastOptions!.onStatusChange('connected', 0));
    expect(useEventsStore.getState().status).toBe('connected');
  });

  it('triggers debounced refetch on sessions-changed event', () => {
    const refetch = vi.fn();
    useSessionsStore.setState({ sessions: [], loading: false, error: null, refetch } as unknown as ReturnType<typeof useSessionsStore.getState>);
    renderHook(() => useEventsSubscription());
    act(() => lastOptions!.onEvent({ type: 'sessions-changed' }));
    act(() => lastOptions!.onEvent({ type: 'sessions-changed' }));
    expect(refetch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w packages/web -- useEventsSubscription`
Expected: FAIL with `Cannot find module '../useEventsSubscription'`

- [ ] **Step 3: Implement hook**

Create `packages/web/src/hooks/useEventsSubscription.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useEventsStore } from '@/stores/events';
import { TmuxEventsClient } from '@/lib/events/client';

const REFETCH_DEBOUNCE_MS = 50;

function buildEventsUrl(gatewayUrl: string, token: string): string {
  const wsUrl = gatewayUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams({ token });
  return `${wsUrl}/ws/events?${params.toString()}`;
}

export function useEventsSubscription(): void {
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    isUnmountedRef.current = false;

    let pending = false;
    let timer: number | null = null;
    const triggerRefetch = (): void => {
      if (pending) return;
      pending = true;
      timer = window.setTimeout(() => {
        pending = false;
        timer = null;
        if (isUnmountedRef.current) return;
        void useSessionsStore.getState().refetch();
      }, REFETCH_DEBOUNCE_MS);
    };

    const client = new TmuxEventsClient({
      url: buildEventsUrl(gatewayUrl, token),
      onEvent: (event) => {
        if (isUnmountedRef.current) return;
        useEventsStore.getState().setLastEvent(event);
        if (
          event.type === 'sessions-changed' ||
          event.type === 'windows-changed' ||
          event.type === 'monitor-restart'
        ) {
          triggerRefetch();
        }
      },
      onStatusChange: (status, attempt) => {
        if (isUnmountedRef.current) return;
        useEventsStore.getState().setStatus(status);
        useEventsStore.getState().setReconnectAttempt(attempt);
      },
    });
    client.start();

    return () => {
      isUnmountedRef.current = true;
      if (timer !== null) window.clearTimeout(timer);
      client.stop();
    };
  }, [token, gatewayUrl]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w packages/web -- useEventsSubscription`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/hooks/
git commit -m "feat(web): add useEventsSubscription hook (singleton + debounced refetch)"
```

---

### Task 6: Wire useEventsSubscription into SessionsRoute + status indicator

**Files:**
- Modify: `packages/web/src/routes/sessions.tsx` (add hook call)
- Modify: `packages/web/src/components/Sidebar.tsx` (add events status dot in bottom nav)
- Test: `packages/web/src/components/__tests__/Sidebar.test.tsx` (extend with status indicator)

- [ ] **Step 1: Extend Sidebar test for status dot**

Replace `packages/web/src/components/__tests__/Sidebar.test.tsx` body with:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useEventsStore } from '@/stores/events';

describe('Sidebar', () => {
  beforeEach(() => {
    useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
  });

  it('renders sessions panel and bottom nav with 3 buttons', () => {
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sessions tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Files tab/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings tab/i })).toBeDisabled();
  });

  it('shows events status indicator (idle by default)', () => {
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Realtime updates/i)).toBeInTheDocument();
  });

  it('reflects connected status', () => {
    useEventsStore.setState({ status: 'connected', reconnectAttempt: 0, lastEvent: null });
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Realtime updates: connected/i)).toBeInTheDocument();
  });

  it('reflects reconnecting status with attempt count', () => {
    useEventsStore.setState({ status: 'reconnecting', reconnectAttempt: 3, lastEvent: null });
    render(<Sidebar sessions={[]} activeSessionId={null} activeWindowIndex={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/Realtime updates: reconnecting \(attempt 3\)/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- Sidebar`
Expected: FAIL ("Realtime updates" label not found)

- [ ] **Step 3: Add status indicator to Sidebar**

In `packages/web/src/components/Sidebar.tsx`, add at the top of imports:

```tsx
import { useEventsStore } from '@/stores/events';
```

Replace the existing `<nav>` block (lines ~46-104) with:

```tsx
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          borderTop: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Sessions tab"
          aria-pressed="true"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.primary,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'pointer',
            padding: tokens.spacing.sm,
          }}
        >
          ⌘ Sessions
        </button>
        <button
          type="button"
          aria-label="Files tab"
          disabled
          title="Coming in Phase 2b"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          📁 Files
        </button>
        <button
          type="button"
          aria-label="Settings tab"
          disabled
          title="Coming in Phase 2b"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          ⚙ Settings
        </button>
        <EventsStatusDot />
      </nav>
```

Add the `EventsStatusDot` component at the bottom of the file (after `Sidebar`):

```tsx
function EventsStatusDot() {
  const { tokens } = useTheme();
  const status = useEventsStore((s) => s.status);
  const attempt = useEventsStore((s) => s.reconnectAttempt);
  const color = (() => {
    switch (status) {
      case 'connected':
        return tokens.colors.success;
      case 'reconnecting':
        return tokens.colors.warning;
      case 'failed':
        return tokens.colors.error;
      default:
        return tokens.colors.textMuted;
    }
  })();
  const label =
    status === 'reconnecting'
      ? `Realtime updates: reconnecting (attempt ${attempt})`
      : `Realtime updates: ${status}`;
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      style={{
        position: 'absolute',
        right: tokens.spacing.md,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}
```

- [ ] **Step 4: Wire useEventsSubscription into SessionsRoute**

In `packages/web/src/routes/sessions.tsx`, add to imports:

```tsx
import { useEventsSubscription } from '@/hooks/useEventsSubscription';
```

Inside `SessionsRoute()`, add this line before the existing `useEffect(...)`:

```tsx
  useEventsSubscription();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -w packages/web -- Sidebar`
Expected: PASS (4/4)

Run: `npm test -w packages/web`
Expected: ALL PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/Sidebar.tsx packages/web/src/components/__tests__/Sidebar.test.tsx packages/web/src/routes/sessions.tsx
git commit -m "feat(web): wire events subscription + status indicator on sidebar"
```

---

## Sub-Phase 2a-2: API client + sessionsStore extensions

### Task 7: Extend ApiClient with session CRUD

**Files:**
- Modify: `packages/web/src/api/client.ts`
- Test: `packages/web/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/web/src/api/__tests__/client.test.ts` (inside the existing `describe('ApiClient', ...)` block, before the closing `});`):

```ts
  it('createSession POSTs to /api/sessions and returns session', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: 'zen_new', displayName: 'new', created: 1, cwd: '/home', windows: [] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const session = await client.createSession({ name: 'new' });
    expect(session.displayName).toBe('new');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe('{"name":"new"}');
  });

  it('createSession works with no name', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: 'zen_auto', displayName: 'auto', created: 1, cwd: '/', windows: [] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    await client.createSession();
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).body).toBe('{}');
  });

  it('renameSession PATCHes /api/sessions/:id and returns updated session', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: 'zen_renamed', displayName: 'renamed', created: 1, cwd: '/', windows: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const session = await client.renameSession('old', { name: 'renamed' });
    expect(session.displayName).toBe('renamed');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/old');
    expect((init as RequestInit).method).toBe('PATCH');
  });

  it('killSession DELETEs /api/sessions/:id', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const client = new ApiClient(baseUrl, token);
    await client.killSession('old');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/old');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('renameSession encodes session id with special characters', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response('{"name":"x","displayName":"x","created":1,"cwd":"/","windows":[]}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new ApiClient(baseUrl, token);
    await client.renameSession('a b', { name: 'x' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/a%20b');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -w packages/web -- api/client`
Expected: FAIL (`createSession` / `renameSession` / `killSession` not defined on ApiClient)

- [ ] **Step 3: Add session CRUD methods to ApiClient**

In `packages/web/src/api/client.ts`, add these methods inside the `ApiClient` class after `listWindows`:

```ts
  createSession(body?: { name?: string }): Promise<TmuxSession> {
    return this.request<TmuxSession>('POST', '/api/sessions', body ?? {});
  }

  renameSession(sessionId: string, body: { name: string }): Promise<TmuxSession> {
    return this.request<TmuxSession>(
      'PATCH',
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      body,
    );
  }

  killSession(sessionId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(
      'DELETE',
      `/api/sessions/${encodeURIComponent(sessionId)}`,
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/web -- api/client`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/api/__tests__/client.test.ts
git commit -m "feat(web): extend ApiClient with session create/rename/delete"
```

---

### Task 8: Extend ApiClient with window CRUD

**Files:**
- Modify: `packages/web/src/api/client.ts`
- Test: `packages/web/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/web/src/api/__tests__/client.test.ts` (inside `describe('ApiClient', ...)` block, before closing `});`):

```ts
  it('createWindow POSTs to /api/sessions/:id/windows', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ index: 2, name: 'w2', active: true, zoomed: false, paneCount: 1, cwd: '/' }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const window = await client.createWindow('dev', { name: 'w2' });
    expect(window.index).toBe(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/dev/windows');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe('{"name":"w2"}');
  });

  it('renameWindow PATCHes /api/sessions/:id/windows/:idx', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ index: 1, name: 'renamed', active: false, zoomed: false, paneCount: 1, cwd: '/' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const window = await client.renameWindow('dev', 1, { name: 'renamed' });
    expect(window.name).toBe('renamed');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/dev/windows/1');
    expect((init as RequestInit).method).toBe('PATCH');
  });

  it('killWindow DELETEs /api/sessions/:id/windows/:idx', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const client = new ApiClient(baseUrl, token);
    await client.killWindow('dev', 1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/dev/windows/1');
    expect((init as RequestInit).method).toBe('DELETE');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -w packages/web -- api/client`
Expected: FAIL (window methods not defined)

- [ ] **Step 3: Add window CRUD methods to ApiClient**

In `packages/web/src/api/client.ts`, add inside `ApiClient` class after `killSession`:

```ts
  createWindow(sessionId: string, body?: { name?: string }): Promise<TmuxWindow> {
    return this.request<TmuxWindow>(
      'POST',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows`,
      body ?? {},
    );
  }

  renameWindow(
    sessionId: string,
    windowIndex: number,
    body: { name: string },
  ): Promise<TmuxWindow> {
    return this.request<TmuxWindow>(
      'PATCH',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows/${windowIndex}`,
      body,
    );
  }

  killWindow(sessionId: string, windowIndex: number): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(
      'DELETE',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows/${windowIndex}`,
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/web -- api/client`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/api/__tests__/client.test.ts
git commit -m "feat(web): extend ApiClient with window create/rename/delete"
```

---

### Task 9: Add sessionsStore.refetch action

**Files:**
- Modify: `packages/web/src/stores/sessions.ts`
- Test: `packages/web/src/stores/__tests__/sessions.test.ts`

- [ ] **Step 1: Write failing test**

Append to `packages/web/src/stores/__tests__/sessions.test.ts` (inside the `describe` block, before closing `});`):

```ts
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
```

Add at the top of the file (after existing imports):

```ts
import { vi } from 'vitest';
```

(If `vi` is already imported, skip the line.)

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- stores/sessions`
Expected: FAIL (`refetch` not defined)

- [ ] **Step 3: Add refetch to store**

Modify `packages/web/src/stores/sessions.ts`. Replace the entire file with:

```ts
import { create } from 'zustand';
import type { TmuxSession } from '@zenterm/shared';

export interface SessionsApiClient {
  listSessions: () => Promise<TmuxSession[]>;
}

interface SessionsState {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  setSessions: (sessions: TmuxSession[]) => void;
  upsert: (session: TmuxSession) => void;
  remove: (name: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refetch: (client: SessionsApiClient) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  loading: false,
  error: null,
  setSessions: (sessions) => set({ sessions }),
  upsert: (session) =>
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.name === session.name);
      if (idx === -1) return { sessions: [...state.sessions, session] };
      const next = [...state.sessions];
      next[idx] = session;
      return { sessions: next };
    }),
  remove: (name) =>
    set((state) => ({ sessions: state.sessions.filter((s) => s.name !== name) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  refetch: async (client) => {
    set({ loading: true });
    try {
      const next = await client.listSessions();
      set({ sessions: next, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: message });
    }
  },
}));
```

Note: `refetch` accepts an `SessionsApiClient` argument so the store stays unaware of how the client is constructed. The hook layer (Task 10/11/etc) creates the client via `useAuthStore` and passes it in. This keeps the store unit-testable without mocking modules.

- [ ] **Step 4: Update useEventsSubscription to pass client**

In `packages/web/src/hooks/useEventsSubscription.ts`, replace the `triggerRefetch` block (and its surrounding closure capture) with:

```ts
    const refetch = (): void => {
      void useSessionsStore.getState().refetch({
        listSessions: () => new ApiClient(gatewayUrl, token).listSessions(),
      });
    };

    let pending = false;
    let timer: number | null = null;
    const triggerRefetch = (): void => {
      if (pending) return;
      pending = true;
      timer = window.setTimeout(() => {
        pending = false;
        timer = null;
        if (isUnmountedRef.current) return;
        refetch();
      }, REFETCH_DEBOUNCE_MS);
    };
```

Add at the top of imports:

```ts
import { ApiClient } from '@/api/client';
```

- [ ] **Step 5: Update useEventsSubscription test for new signature**

In `packages/web/src/hooks/__tests__/useEventsSubscription.test.tsx`, replace the `'triggers debounced refetch on sessions-changed event'` test body with:

```tsx
  it('triggers debounced refetch on sessions-changed event', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    useSessionsStore.setState({
      sessions: [],
      loading: false,
      error: null,
      refetch,
    } as Partial<ReturnType<typeof useSessionsStore.getState>> as ReturnType<typeof useSessionsStore.getState>);
    renderHook(() => useEventsSubscription());
    act(() => lastOptions!.onEvent({ type: 'sessions-changed' }));
    act(() => lastOptions!.onEvent({ type: 'sessions-changed' }));
    expect(refetch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60));
    expect(refetch).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 6: Update SessionsRoute initial fetch to use refetch**

In `packages/web/src/routes/sessions.tsx`, replace the initial-load `useEffect` with:

```tsx
  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const client = new ApiClient(gatewayUrl, token);
    useSessionsStore.getState()
      .refetch(client)
      .catch((err) => {
        if (err instanceof HttpError && err.status === 401) {
          logout();
          navigate('/web/login', { replace: true });
        }
      });
  }, [token, gatewayUrl, logout, navigate]);
```

Remove the now-unused `setSessions`, `setError` selectors at the top of `SessionsRoute`.

- [ ] **Step 7: Run all web tests**

Run: `npm test -w packages/web`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/stores/sessions.ts packages/web/src/stores/__tests__/sessions.test.ts packages/web/src/hooks/useEventsSubscription.ts packages/web/src/hooks/__tests__/useEventsSubscription.test.tsx packages/web/src/routes/sessions.tsx
git commit -m "feat(web): add sessionsStore.refetch and route through it"
```

---

### Task 10: Add session CRUD actions to sessionsStore + fallback

**Files:**
- Modify: `packages/web/src/stores/sessions.ts`
- Test: `packages/web/src/stores/__tests__/sessions.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/web/src/stores/__tests__/sessions.test.ts` (inside `describe`, before closing `});`):

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- stores/sessions`
Expected: FAIL (`create` / `rename` / `removeSession` not defined)

- [ ] **Step 3: Extend SessionsApiClient and store**

In `packages/web/src/stores/sessions.ts`, replace the file with:

```ts
import { create } from 'zustand';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useSessionViewStore } from './sessionView';

export interface SessionsApiClient {
  listSessions: () => Promise<TmuxSession[]>;
  createSession: (body?: { name?: string }) => Promise<TmuxSession>;
  renameSession: (sessionId: string, body: { name: string }) => Promise<TmuxSession>;
  killSession: (sessionId: string) => Promise<{ ok: true }>;
  createWindow: (sessionId: string, body?: { name?: string }) => Promise<TmuxWindow>;
  renameWindow: (
    sessionId: string,
    windowIndex: number,
    body: { name: string },
  ) => Promise<TmuxWindow>;
  killWindow: (sessionId: string, windowIndex: number) => Promise<{ ok: true }>;
}

interface SessionsState {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  setSessions: (sessions: TmuxSession[]) => void;
  upsert: (session: TmuxSession) => void;
  remove: (name: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refetch: (client: Pick<SessionsApiClient, 'listSessions'>) => Promise<void>;
  create: (
    client: Pick<SessionsApiClient, 'createSession'>,
    body?: { name?: string },
  ) => Promise<TmuxSession>;
  rename: (
    client: Pick<SessionsApiClient, 'renameSession'>,
    currentId: string,
    newName: string,
  ) => Promise<TmuxSession>;
  removeSession: (
    client: Pick<SessionsApiClient, 'killSession'>,
    id: string,
  ) => Promise<void>;
}

function fallbackAfterRemove(removedDisplayName: string, remaining: TmuxSession[]): void {
  const view = useSessionViewStore.getState();
  if (view.activeSessionId !== removedDisplayName) return;
  const next = remaining.find((s) => s.displayName !== removedDisplayName);
  if (next) {
    view.open(next.displayName, next.windows?.[0]?.index ?? 0);
  } else {
    view.close();
  }
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,
  setSessions: (sessions) => set({ sessions }),
  upsert: (session) =>
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.name === session.name);
      if (idx === -1) return { sessions: [...state.sessions, session] };
      const next = [...state.sessions];
      next[idx] = session;
      return { sessions: next };
    }),
  remove: (name) =>
    set((state) => ({ sessions: state.sessions.filter((s) => s.name !== name) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  refetch: async (client) => {
    set({ loading: true });
    try {
      const next = await client.listSessions();
      set({ sessions: next, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: message });
    }
  },
  create: async (client, body) => {
    const created = await client.createSession(body);
    set({ sessions: [...get().sessions, created] });
    return created;
  },
  rename: async (client, currentId, newName) => {
    const updated = await client.renameSession(currentId, { name: newName });
    set({
      sessions: get().sessions.map((s) =>
        s.displayName === currentId ? updated : s,
      ),
    });
    const view = useSessionViewStore.getState();
    if (view.activeSessionId === currentId) {
      view.open(updated.displayName, view.activeWindowIndex ?? 0);
    }
    return updated;
  },
  removeSession: async (client, id) => {
    await client.killSession(id);
    const remaining = get().sessions.filter((s) => s.displayName !== id);
    set({ sessions: remaining });
    fallbackAfterRemove(id, remaining);
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/web -- stores/sessions`
Expected: PASS

- [ ] **Step 5: Verify fallback behavior with sessionView**

Add to `packages/web/src/stores/__tests__/sessions.test.ts`:

```ts
import { useSessionViewStore } from '../sessionView';

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
```

Run: `npm test -w packages/web -- stores/sessions`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/stores/sessions.ts packages/web/src/stores/__tests__/sessions.test.ts
git commit -m "feat(web): add session create/rename/remove with fallback to sessionView"
```

---

### Task 11: Add window CRUD actions to sessionsStore

**Files:**
- Modify: `packages/web/src/stores/sessions.ts`
- Test: `packages/web/src/stores/__tests__/sessions.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/web/src/stores/__tests__/sessions.test.ts` (inside `describe`, before closing `});`):

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- stores/sessions`
Expected: FAIL (`createWindow` / `renameWindow` / `removeWindow` not defined)

- [ ] **Step 3: Extend store with window actions**

In `packages/web/src/stores/sessions.ts`, expand the `SessionsState` interface to include:

```ts
  createWindow: (
    client: Pick<SessionsApiClient, 'createWindow' | 'listSessions'>,
    sessionId: string,
    body?: { name?: string },
  ) => Promise<void>;
  renameWindow: (
    client: Pick<SessionsApiClient, 'renameWindow' | 'listSessions'>,
    sessionId: string,
    windowIndex: number,
    newName: string,
  ) => Promise<void>;
  removeWindow: (
    client: Pick<SessionsApiClient, 'killWindow' | 'listSessions'>,
    sessionId: string,
    windowIndex: number,
  ) => Promise<void>;
```

Add the implementations to the store:

```ts
  createWindow: async (client, sessionId, body) => {
    await client.createWindow(sessionId, body);
    await get().refetch(client);
  },
  renameWindow: async (client, sessionId, windowIndex, newName) => {
    await client.renameWindow(sessionId, windowIndex, { name: newName });
    await get().refetch(client);
  },
  removeWindow: async (client, sessionId, windowIndex) => {
    await client.killWindow(sessionId, windowIndex);
    await get().refetch(client);
    fallbackAfterRemoveWindow(sessionId, windowIndex);
  },
```

Add the fallback function near `fallbackAfterRemove`:

```ts
function fallbackAfterRemoveWindow(sessionId: string, removedIndex: number): void {
  const view = useSessionViewStore.getState();
  if (view.activeSessionId !== sessionId || view.activeWindowIndex !== removedIndex) return;
  const session = useSessionsStore.getState().sessions.find((s) => s.displayName === sessionId);
  if (!session || !session.windows || session.windows.length === 0) {
    fallbackAfterRemove(sessionId, useSessionsStore.getState().sessions);
    return;
  }
  const sorted = [...session.windows].sort((a, b) => a.index - b.index);
  const next = sorted.find((w) => w.index > removedIndex) ?? sorted[sorted.length - 1];
  view.open(sessionId, next.index);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/web -- stores/sessions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/sessions.ts packages/web/src/stores/__tests__/sessions.test.ts
git commit -m "feat(web): add window create/rename/remove actions with refetch + fallback"
```

---

## Sub-Phase 2a-3: UI primitives

### Task 12: Add uiStore (confirmDialog + toasts)

**Files:**
- Create: `packages/web/src/stores/ui.ts`
- Test: `packages/web/src/stores/__tests__/ui.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/stores/__tests__/ui.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useUiStore } from '../ui';

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ confirmDialog: null, toasts: [] });
  });

  it('showConfirm sets confirmDialog payload', () => {
    const onConfirm = vi.fn();
    useUiStore.getState().showConfirm({
      title: 'Delete',
      message: 'Sure?',
      destructive: true,
      onConfirm,
    });
    expect(useUiStore.getState().confirmDialog).toMatchObject({
      title: 'Delete',
      message: 'Sure?',
      destructive: true,
    });
  });

  it('hideConfirm clears confirmDialog', () => {
    useUiStore.getState().showConfirm({ title: 't', message: 'm', onConfirm: vi.fn() });
    useUiStore.getState().hideConfirm();
    expect(useUiStore.getState().confirmDialog).toBeNull();
  });

  it('pushToast appends with auto-generated id', () => {
    useUiStore.getState().pushToast({ type: 'info', message: 'hi' });
    useUiStore.getState().pushToast({ type: 'error', message: 'boom' });
    const toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    expect(toasts[0].message).toBe('hi');
    expect(toasts[0].id).not.toBe(toasts[1].id);
  });

  it('dismissToast removes by id', () => {
    useUiStore.getState().pushToast({ type: 'info', message: 'a' });
    useUiStore.getState().pushToast({ type: 'info', message: 'b' });
    const firstId = useUiStore.getState().toasts[0].id;
    useUiStore.getState().dismissToast(firstId);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['b']);
  });

  it('caps toasts queue at 5 entries (drops oldest)', () => {
    for (let i = 0; i < 7; i += 1) {
      useUiStore.getState().pushToast({ type: 'info', message: `t${i}` });
    }
    const toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(5);
    expect(toasts[0].message).toBe('t2');
    expect(toasts[4].message).toBe('t6');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- stores/ui`
Expected: FAIL (`Cannot find module '../ui'`)

- [ ] **Step 3: Implement uiStore**

Create `packages/web/src/stores/ui.ts`:

```ts
import { create } from 'zustand';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export interface ToastEntry {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
  durationMs?: number;
}

interface UiState {
  confirmDialog: ConfirmDialogConfig | null;
  toasts: ToastEntry[];
  showConfirm: (cfg: ConfirmDialogConfig) => void;
  hideConfirm: () => void;
  pushToast: (toast: Omit<ToastEntry, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const MAX_TOASTS = 5;
let toastCounter = 0;

function nextToastId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}-${Date.now()}`;
}

export const useUiStore = create<UiState>((set) => ({
  confirmDialog: null,
  toasts: [],
  showConfirm: (cfg) => set({ confirmDialog: cfg }),
  hideConfirm: () => set({ confirmDialog: null }),
  pushToast: (toast) =>
    set((state) => {
      const next = [...state.toasts, { ...toast, id: nextToastId() }];
      const trimmed = next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      return { toasts: trimmed };
    }),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -w packages/web -- stores/ui`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/ui.ts packages/web/src/stores/__tests__/ui.test.ts
git commit -m "feat(web): add uiStore (confirmDialog + toasts queue capped at 5)"
```

---

### Task 13: Add validateName helper

**Files:**
- Create: `packages/web/src/lib/validateName.ts`
- Test: `packages/web/src/lib/__tests__/validateName.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/lib/__tests__/validateName.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateSessionOrWindowName } from '../validateName';

describe('validateSessionOrWindowName', () => {
  it('returns null for valid names', () => {
    expect(validateSessionOrWindowName('zen_dev')).toBeNull();
    expect(validateSessionOrWindowName('main-2')).toBeNull();
    expect(validateSessionOrWindowName('w0')).toBeNull();
  });

  it('rejects empty / whitespace-only', () => {
    expect(validateSessionOrWindowName('')).toBe('名前を入力してください');
    expect(validateSessionOrWindowName('   ')).toBe('名前を入力してください');
  });

  it('rejects names longer than 64 chars', () => {
    const long = 'a'.repeat(65);
    expect(validateSessionOrWindowName(long)).toBe('64 文字以内で入力してください');
  });

  it('rejects names with unsupported characters', () => {
    expect(validateSessionOrWindowName('foo bar')).toBe('英数字・_・- のみ使用できます');
    expect(validateSessionOrWindowName('foo.bar')).toBe('英数字・_・- のみ使用できます');
    expect(validateSessionOrWindowName('日本語')).toBe('英数字・_・- のみ使用できます');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateSessionOrWindowName('  ok  ')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- validateName`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement helper**

Create `packages/web/src/lib/validateName.ts`:

```ts
const ALLOWED = /^[A-Za-z0-9_-]+$/;
const MAX_LEN = 64;

export function validateSessionOrWindowName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '名前を入力してください';
  if (trimmed.length > MAX_LEN) return '64 文字以内で入力してください';
  if (!ALLOWED.test(trimmed)) return '英数字・_・- のみ使用できます';
  return null;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- validateName`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/validateName.ts packages/web/src/lib/__tests__/validateName.test.ts
git commit -m "feat(web): add session/window name client-side validator"
```

---

### Task 14: Add InlineEdit component

**Files:**
- Create: `packages/web/src/components/ui/InlineEdit.tsx`
- Test: `packages/web/src/components/ui/__tests__/InlineEdit.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/ui/__tests__/InlineEdit.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEdit } from '../InlineEdit';

describe('InlineEdit', () => {
  it('renders the initial value in an input', () => {
    render(<InlineEdit value="hello" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });

  it('calls onSave with new value on Enter', async () => {
    const onSave = vi.fn();
    render(<InlineEdit value="hello" onSave={onSave} onCancel={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'new{Enter}');
    expect(onSave).toHaveBeenCalledWith('new');
  });

  it('calls onCancel on Escape', async () => {
    const onCancel = vi.fn();
    render(<InlineEdit value="hello" onSave={vi.fn()} onCancel={onCancel} />);
    await userEvent.type(screen.getByRole('textbox'), '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSave on blur (treats blur as commit)', async () => {
    const onSave = vi.fn();
    render(
      <>
        <InlineEdit value="hello" onSave={onSave} onCancel={vi.fn()} />
        <button>elsewhere</button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: /elsewhere/i }));
    expect(onSave).toHaveBeenCalledWith('hello');
  });

  it('shows validation error and blocks save', async () => {
    const onSave = vi.fn();
    render(
      <InlineEdit
        value="ok"
        onSave={onSave}
        onCancel={vi.fn()}
        validate={(v) => (v.length < 3 ? 'too short' : null)}
      />,
    );
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'no{Enter}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('too short')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('autofocuses on mount', () => {
    render(<InlineEdit value="hello" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- InlineEdit`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement InlineEdit**

Create `packages/web/src/components/ui/InlineEdit.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '@/theme';

export interface InlineEditProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  onCancel: () => void;
  validate?: (next: string) => string | null;
  maxLength?: number;
  placeholder?: string;
  ariaLabel?: string;
}

export function InlineEdit({
  value,
  onSave,
  onCancel,
  validate,
  maxLength = 64,
  placeholder,
  ariaLabel = '名前を編集',
}: InlineEditProps) {
  const { tokens } = useTheme();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submittedRef = useRef(false);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const attemptSave = (): void => {
    const validationError = validate ? validate(text) : null;
    if (validationError) {
      setError(validationError);
      return;
    }
    submittedRef.current = true;
    void onSave(text.trim());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            attemptSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (submittedRef.current) return;
          attemptSave();
        }}
        style={{
          width: '100%',
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
          background: tokens.colors.surface,
          color: tokens.colors.textPrimary,
          border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.bodyMedium.fontSize,
          fontFamily: 'inherit',
        }}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontSize: tokens.typography.caption.fontSize,
            color: tokens.colors.error,
            paddingLeft: tokens.spacing.sm,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- InlineEdit`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/ui/InlineEdit.tsx packages/web/src/components/ui/__tests__/InlineEdit.test.tsx
git commit -m "feat(web): add InlineEdit component (Enter/Esc/blur + validate)"
```

---

### Task 15: Add ConfirmDialog component

**Files:**
- Create: `packages/web/src/components/ui/ConfirmDialog.tsx`
- Test: `packages/web/src/components/ui/__tests__/ConfirmDialog.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/ui/__tests__/ConfirmDialog.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

beforeEach(() => {
  // jsdom does not implement HTMLDialogElement methods
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
});

describe('ConfirmDialog', () => {
  it('does not render content when open=false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="t"
        message="m"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText('t')).not.toBeInTheDocument();
  });

  it('renders title and message when open', () => {
    render(
      <ConfirmDialog
        open
        title="Delete"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Sure?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        message="m"
        confirmLabel="Yes"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Yes/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        message="m"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /No/ }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('uses default labels when none provided', () => {
    render(
      <ConfirmDialog open title="t" message="m" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- ConfirmDialog`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement ConfirmDialog**

Create `packages/web/src/components/ui/ConfirmDialog.tsx`:

```tsx
import { useEffect, useId, useRef } from 'react';
import { useTheme } from '@/theme';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '削除',
  cancelLabel = 'キャンセル',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { tokens } = useTheme();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClose={() => onCancel()}
      style={{
        padding: 0,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.lg,
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        maxWidth: 420,
      }}
    >
      <div style={{ padding: tokens.spacing.lg, display: 'grid', gap: tokens.spacing.md }}>
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontSize: tokens.typography.heading.fontSize,
            fontWeight: tokens.typography.heading.fontWeight,
          }}
        >
          {title}
        </h2>
        <p
          id={messageId}
          style={{
            margin: 0,
            fontSize: tokens.typography.bodyMedium.fontSize,
            color: tokens.colors.textSecondary,
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing.sm }}>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            style={{
              padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
              background: 'transparent',
              color: tokens.colors.textPrimary,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radii.sm,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            style={{
              padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
              background: destructive ? tokens.colors.error : tokens.colors.primary,
              color: tokens.colors.textInverse,
              border: 'none',
              borderRadius: tokens.radii.sm,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- ConfirmDialog`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/ui/ConfirmDialog.tsx packages/web/src/components/ui/__tests__/ConfirmDialog.test.tsx
git commit -m "feat(web): add ConfirmDialog component (<dialog> based modal)"
```

---

### Task 16: Add Toast + ToastViewport components

**Files:**
- Create: `packages/web/src/components/ui/Toast.tsx`
- Create: `packages/web/src/components/ui/ToastViewport.tsx`
- Test: `packages/web/src/components/ui/__tests__/ToastViewport.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/ui/__tests__/ToastViewport.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastViewport } from '../ToastViewport';
import { useUiStore } from '@/stores/ui';

describe('ToastViewport', () => {
  beforeEach(() => {
    useUiStore.setState({ confirmDialog: null, toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no toasts initially', () => {
    render(<ToastViewport />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an error toast with role=alert', () => {
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'error', message: 'boom' });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('renders an info toast with role=status', () => {
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'info', message: 'hi' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('hi');
  });

  it('manual dismiss via close button', async () => {
    vi.useRealTimers();
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'info', message: 'msg' });
    });
    await userEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByText('msg')).not.toBeInTheDocument();
  });

  it('auto-dismisses after default duration', () => {
    render(<ToastViewport />);
    act(() => {
      useUiStore.getState().pushToast({ type: 'info', message: 'auto' });
    });
    expect(screen.getByText('auto')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('auto')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- ToastViewport`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement Toast**

Create `packages/web/src/components/ui/Toast.tsx`:

```tsx
import { useEffect } from 'react';
import { useTheme } from '@/theme';
import type { ToastEntry } from '@/stores/ui';

export interface ToastProps {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
}

const DEFAULT_DURATION_MS = 4000;

export function Toast({ toast, onDismiss }: ToastProps) {
  const { tokens } = useTheme();
  const duration = toast.durationMs ?? DEFAULT_DURATION_MS;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const background = (() => {
    switch (toast.type) {
      case 'error':
        return tokens.colors.error;
      case 'success':
        return tokens.colors.success;
      default:
        return tokens.colors.bgElevated;
    }
  })();
  const color = toast.type === 'error' || toast.type === 'success'
    ? tokens.colors.textInverse
    : tokens.colors.textPrimary;

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      style={{
        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
        borderRadius: tokens.radii.md,
        background,
        color,
        border: `1px solid ${tokens.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        minWidth: 240,
      }}
    >
      <span style={{ flex: 1, fontSize: tokens.typography.smallMedium.fontSize }}>
        {toast.message}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'transparent',
          color,
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: tokens.typography.bodyMedium.fontSize,
        }}
      >
        ×
      </button>
    </div>
  );
}
```

Create `packages/web/src/components/ui/ToastViewport.tsx`:

```tsx
import { useUiStore } from '@/stores/ui';
import { Toast } from './Toast';

export function ToastViewport() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- ToastViewport`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/ui/Toast.tsx packages/web/src/components/ui/ToastViewport.tsx packages/web/src/components/ui/__tests__/ToastViewport.test.tsx
git commit -m "feat(web): add Toast + ToastViewport (auto dismiss + manual close)"
```

---

### Task 17: Add RowActionsMenu (kebab popover)

**Files:**
- Create: `packages/web/src/components/sidebar/RowActionsMenu.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/RowActionsMenu.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/sidebar/__tests__/RowActionsMenu.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsMenu } from '../RowActionsMenu';

describe('RowActionsMenu', () => {
  const items = [
    { label: 'Rename', onClick: vi.fn() },
    { label: 'Delete', onClick: vi.fn(), destructive: true },
  ];

  it('does not render content when closed', () => {
    render(
      <RowActionsMenu open={false} anchorEl={null} items={items} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders menu items when open', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <RowActionsMenu open anchorEl={anchor} items={items} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('clicking an item calls its onClick and onClose', async () => {
    const renameClick = vi.fn();
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const items = [{ label: 'Rename', onClick: renameClick }];
    render(<RowActionsMenu open anchorEl={anchor} items={items} onClose={onClose} />);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(renameClick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape closes the menu', async () => {
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<RowActionsMenu open anchorEl={anchor} items={items} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking outside closes the menu', async () => {
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <>
        <RowActionsMenu open anchorEl={anchor} items={items} onClose={onClose} />
        <div data-testid="outside" style={{ width: 50, height: 50 }} />
      </>,
    );
    await userEvent.click(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- RowActionsMenu`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement RowActionsMenu**

Create `packages/web/src/components/sidebar/RowActionsMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme';

export interface RowActionsMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export interface RowActionsMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: RowActionsMenuItem[];
  onClose: () => void;
}

export function RowActionsMenu({ open, anchorEl, items, onClose }: RowActionsMenuProps) {
  const { tokens } = useTheme();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 160;
    const flipLeft = rect.right + menuWidth > window.innerWidth;
    setPosition({
      top: rect.bottom + 4,
      left: flipLeft ? rect.right - menuWidth : rect.left,
    });
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      if (anchorEl && target && anchorEl.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open, anchorEl, onClose]);

  if (!open || !position) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        minWidth: 160,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        padding: tokens.spacing.xs,
        zIndex: 100,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onClick();
            onClose();
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
            background: 'transparent',
            color: item.destructive ? tokens.colors.error : tokens.colors.textPrimary,
            border: 'none',
            borderRadius: tokens.radii.sm,
            cursor: 'pointer',
            fontSize: tokens.typography.smallMedium.fontSize,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- RowActionsMenu`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/sidebar/RowActionsMenu.tsx packages/web/src/components/sidebar/__tests__/RowActionsMenu.test.tsx
git commit -m "feat(web): add RowActionsMenu kebab popover (Esc + outside click)"
```

---

### Task 18: Wire ConfirmDialog + ToastViewport at App root

**Files:**
- Create: `packages/web/src/components/ui/ConfirmDialogHost.tsx`
- Modify: `packages/web/src/App.tsx`
- Test: `packages/web/src/components/ui/__tests__/ConfirmDialogHost.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/ui/__tests__/ConfirmDialogHost.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialogHost } from '../ConfirmDialogHost';
import { useUiStore } from '@/stores/ui';

beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
  useUiStore.setState({ confirmDialog: null, toasts: [] });
});

describe('ConfirmDialogHost', () => {
  it('renders nothing when no dialog requested', () => {
    render(<ConfirmDialogHost />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog from uiStore', () => {
    render(<ConfirmDialogHost />);
    act(() => {
      useUiStore.getState().showConfirm({
        title: 'Delete',
        message: 'Sure?',
        onConfirm: vi.fn(),
      });
    });
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('confirm invokes callback then hides dialog', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialogHost />);
    act(() => {
      useUiStore.getState().showConfirm({
        title: 't',
        message: 'm',
        confirmLabel: 'Yes',
        onConfirm,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: /Yes/ }));
    expect(onConfirm).toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog).toBeNull();
  });

  it('cancel hides dialog without invoking onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialogHost />);
    act(() => {
      useUiStore.getState().showConfirm({
        title: 't',
        message: 'm',
        cancelLabel: 'No',
        onConfirm,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: /No/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- ConfirmDialogHost`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement ConfirmDialogHost**

Create `packages/web/src/components/ui/ConfirmDialogHost.tsx`:

```tsx
import { useUiStore } from '@/stores/ui';
import { ConfirmDialog } from './ConfirmDialog';

export function ConfirmDialogHost() {
  const config = useUiStore((s) => s.confirmDialog);
  const hide = useUiStore((s) => s.hideConfirm);

  if (!config) {
    return (
      <ConfirmDialog
        open={false}
        title=""
        message=""
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      title={config.title}
      message={config.message}
      destructive={config.destructive}
      confirmLabel={config.confirmLabel}
      cancelLabel={config.cancelLabel}
      onConfirm={async () => {
        await config.onConfirm();
        hide();
      }}
      onCancel={hide}
    />
  );
}
```

- [ ] **Step 4: Wire into App**

In `packages/web/src/App.tsx`, replace the entire return with:

```tsx
import { Route, Routes, Navigate } from 'react-router-dom';
import { LoginRoute } from './routes/login';
import { SessionsRoute } from './routes/sessions';
import { useAuthStore } from './stores/auth';
import { ConfirmDialogHost } from './components/ui/ConfirmDialogHost';
import { ToastViewport } from './components/ui/ToastViewport';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthed) return <Navigate to="/web/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/web/login" element={<LoginRoute />} />
        <Route
          path="/web/sessions"
          element={
            <RequireAuth>
              <SessionsRoute />
            </RequireAuth>
          }
        />
        <Route path="/web" element={<Navigate to="/web/sessions" replace />} />
        <Route path="*" element={<Navigate to="/web" replace />} />
      </Routes>
      <ConfirmDialogHost />
      <ToastViewport />
    </>
  );
}
```

- [ ] **Step 5: Run all web tests**

Run: `npm test -w packages/web`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/ui/ConfirmDialogHost.tsx packages/web/src/components/ui/__tests__/ConfirmDialogHost.test.tsx packages/web/src/App.tsx
git commit -m "feat(web): mount ConfirmDialogHost and ToastViewport at app root"
```

---

## Sub-Phase 2a-4: Sidebar refactor (Row 分割 + create UI)

### Task 19: Add SessionRow component

**Files:**
- Create: `packages/web/src/components/sidebar/SessionRow.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxSession } from '@zenterm/shared';
import { SessionRow } from '../SessionRow';

const session: TmuxSession = {
  name: 'zen_dev',
  displayName: 'dev',
  created: 1,
  cwd: '/home/me',
  windows: [
    { index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/home/me' },
    { index: 1, name: 'test', active: false, zoomed: false, paneCount: 1, cwd: '/home/me' },
  ],
};

describe('SessionRow', () => {
  it('renders displayName and cwd', () => {
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('/home/me')).toBeInTheDocument();
  });

  it('clicking row calls onSelect with displayName', async () => {
    const onSelect = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={onSelect}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('dev'));
    expect(onSelect).toHaveBeenCalledWith('dev', undefined);
  });

  it('expand toggle is visible when window count > 1', async () => {
    const onToggleExpand = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={onToggleExpand}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Expand windows/i));
    expect(onToggleExpand).toHaveBeenCalledWith('zen_dev');
  });

  it('kebab menu opens on click and offers Rename + Delete', async () => {
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    expect(screen.getByRole('menuitem', { name: /Rename/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
  });

  it('Rename click triggers inline edit and onRename on Enter', async () => {
    const onRename = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={onRename}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');
    expect(onRename).toHaveBeenCalledWith('dev', 'renamed');
  });

  it('Delete click calls onRequestDelete', async () => {
    const onRequestDelete = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(onRequestDelete).toHaveBeenCalledWith(session);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- SessionRow`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement SessionRow**

Create `packages/web/src/components/sidebar/SessionRow.tsx`:

```tsx
import { useRef, useState } from 'react';
import type { TmuxSession } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { validateSessionOrWindowName } from '@/lib/validateName';
import { RowActionsMenu } from './RowActionsMenu';

export interface SessionRowProps {
  session: TmuxSession;
  isActive: boolean;
  isExpanded: boolean;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
  onToggleExpand: (sessionName: string) => void;
  onRename: (currentDisplayName: string, newName: string) => void | Promise<void>;
  onRequestDelete: (session: TmuxSession) => void;
}

type RowMode = 'idle' | 'editing-name';

export function SessionRow({
  session,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpand,
  onRename,
  onRequestDelete,
}: SessionRowProps) {
  const { tokens } = useTheme();
  const [mode, setMode] = useState<RowMode>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);

  const hasWindows = (session.windows?.length ?? 0) > 1;
  const showKebab = hover || menuOpen;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        onClick={() => onSelect(session.displayName, undefined)}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          padding: tokens.spacing.sm,
          margin: 0,
          background: isActive ? tokens.colors.primarySubtle : 'transparent',
          color: tokens.colors.textPrimary,
          border: 'none',
          borderRadius: tokens.radii.sm,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: tokens.colors.success,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          {mode === 'editing-name' ? (
            <InlineEdit
              value={session.displayName}
              validate={validateSessionOrWindowName}
              ariaLabel="セッション名を編集"
              onSave={async (next) => {
                await onRename(session.displayName, next);
                setMode('idle');
              }}
              onCancel={() => setMode('idle')}
            />
          ) : (
            <>
              <span style={{ display: 'block', fontSize: tokens.typography.bodyMedium.fontSize }}>
                {session.displayName}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: tokens.typography.small.fontSize,
                  color: tokens.colors.textMuted,
                  fontFamily: tokens.typography.mono.fontFamily,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={session.cwd}
              >
                {session.cwd}
              </span>
            </>
          )}
        </span>
        {hasWindows && (
          <span
            role="button"
            tabIndex={0}
            aria-label={isExpanded ? 'Collapse windows' : 'Expand windows'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(session.name);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleExpand(session.name);
              }
            }}
            style={{
              padding: tokens.spacing.xs,
              color: tokens.colors.textMuted,
              cursor: 'pointer',
              fontSize: tokens.typography.caption.fontSize,
            }}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
        <button
          ref={kebabRef}
          type="button"
          aria-label={`Actions for session ${session.displayName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(true);
          }}
          style={{
            padding: tokens.spacing.xs,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.bodyMedium.fontSize,
            visibility: showKebab ? 'visible' : 'hidden',
          }}
        >
          ⋯
        </button>
      </button>
      <RowActionsMenu
        open={menuOpen}
        anchorEl={kebabRef.current}
        items={[
          { label: 'Rename', onClick: () => setMode('editing-name') },
          { label: 'Delete', onClick: () => onRequestDelete(session), destructive: true },
        ]}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- SessionRow`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/sidebar/SessionRow.tsx packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx
git commit -m "feat(web): add SessionRow with hover kebab + inline rename"
```

---

### Task 20: Add WindowRow component

**Files:**
- Create: `packages/web/src/components/sidebar/WindowRow.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxWindow } from '@zenterm/shared';
import { WindowRow } from '../WindowRow';

const window: TmuxWindow = {
  index: 1,
  name: 'test',
  active: false,
  zoomed: false,
  paneCount: 1,
  cwd: '/home/me',
};

describe('WindowRow', () => {
  it('renders window name', () => {
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('clicking row calls onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={onSelect}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('test'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('Rename via kebab triggers onRename with new name', async () => {
    const onRename = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={vi.fn()}
        onRename={onRename}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for window test/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');
    expect(onRename).toHaveBeenCalledWith('dev', 1, 'renamed');
  });

  it('Delete via kebab calls onRequestDelete', async () => {
    const onRequestDelete = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for window test/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(onRequestDelete).toHaveBeenCalledWith('dev', window);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- WindowRow`
Expected: FAIL

- [ ] **Step 3: Implement WindowRow**

Create `packages/web/src/components/sidebar/WindowRow.tsx`:

```tsx
import { useRef, useState } from 'react';
import type { TmuxWindow } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { validateSessionOrWindowName } from '@/lib/validateName';
import { RowActionsMenu } from './RowActionsMenu';

export interface WindowRowProps {
  sessionDisplayName: string;
  window: TmuxWindow;
  isActive: boolean;
  onSelect: () => void;
  onRename: (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ) => void | Promise<void>;
  onRequestDelete: (sessionDisplayName: string, window: TmuxWindow) => void;
}

type RowMode = 'idle' | 'editing-name';

export function WindowRow({
  sessionDisplayName,
  window,
  isActive,
  onSelect,
  onRename,
  onRequestDelete,
}: WindowRowProps) {
  const { tokens } = useTheme();
  const [mode, setMode] = useState<RowMode>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);
  const showKebab = hover || menuOpen;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        onClick={onSelect}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: tokens.spacing.xs,
          background: isActive ? tokens.colors.primarySubtle : 'transparent',
          border: 'none',
          color: tokens.colors.textSecondary,
          cursor: 'pointer',
          fontSize: tokens.typography.smallMedium.fontSize,
        }}
      >
        {mode === 'editing-name' ? (
          <InlineEdit
            value={window.name}
            validate={validateSessionOrWindowName}
            ariaLabel="window 名を編集"
            onSave={async (next) => {
              await onRename(sessionDisplayName, window.index, next);
              setMode('idle');
            }}
            onCancel={() => setMode('idle')}
          />
        ) : (
          window.name
        )}
      </button>
      <button
        ref={kebabRef}
        type="button"
        aria-label={`Actions for window ${window.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(true);
        }}
        style={{
          padding: tokens.spacing.xs,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: tokens.colors.textMuted,
          visibility: showKebab ? 'visible' : 'hidden',
        }}
      >
        ⋯
      </button>
      <RowActionsMenu
        open={menuOpen}
        anchorEl={kebabRef.current}
        items={[
          { label: 'Rename', onClick: () => setMode('editing-name') },
          {
            label: 'Delete',
            onClick: () => onRequestDelete(sessionDisplayName, window),
            destructive: true,
          },
        ]}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- WindowRow`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/sidebar/WindowRow.tsx packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx
git commit -m "feat(web): add WindowRow with hover kebab + inline rename"
```

---

### Task 21: Add NewSessionButton

**Files:**
- Create: `packages/web/src/components/sidebar/NewSessionButton.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/NewSessionButton.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/sidebar/__tests__/NewSessionButton.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewSessionButton } from '../NewSessionButton';

describe('NewSessionButton', () => {
  it('shows "+ 新規セッション" label initially', () => {
    render(<NewSessionButton onCreate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /新規セッション/ })).toBeInTheDocument();
  });

  it('clicking shows InlineEdit, Enter calls onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSessionButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'new1{Enter}');
    expect(onCreate).toHaveBeenCalledWith('new1');
  });

  it('Enter on empty input calls onCreate with undefined (server default)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewSessionButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    const input = screen.getByRole('textbox');
    // Empty must bypass validation since session create allows server default
    await userEvent.click(input); // focus it
    await userEvent.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledWith(undefined);
  });

  it('Esc cancels back to button', async () => {
    render(<NewSessionButton onCreate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /新規セッション/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- NewSessionButton`
Expected: FAIL

- [ ] **Step 3: Implement NewSessionButton**

Create `packages/web/src/components/sidebar/NewSessionButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme';
import { validateSessionOrWindowName } from '@/lib/validateName';

export interface NewSessionButtonProps {
  onCreate: (name?: string) => void | Promise<void>;
}

export function NewSessionButton({ onCreate }: NewSessionButtonProps) {
  const { tokens } = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const submit = (): void => {
    const trimmed = text.trim();
    if (trimmed === '') {
      void onCreate(undefined);
      setEditing(false);
      setText('');
      return;
    }
    const validationError = validateSessionOrWindowName(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    void onCreate(trimmed);
    setEditing(false);
    setText('');
    setError(null);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          width: '100%',
          padding: tokens.spacing.sm,
          background: 'transparent',
          color: tokens.colors.textSecondary,
          border: `1px dashed ${tokens.colors.borderSubtle}`,
          borderRadius: tokens.radii.sm,
          cursor: 'pointer',
          fontSize: tokens.typography.smallMedium.fontSize,
          textAlign: 'left',
        }}
      >
        + 新規セッション
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        placeholder="セッション名 (空で自動)"
        aria-label="新規セッション名"
        aria-invalid={error ? 'true' : 'false'}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
            setText('');
            setError(null);
          }
        }}
        onBlur={() => {
          setEditing(false);
          setText('');
          setError(null);
        }}
        style={{
          width: '100%',
          padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
          background: tokens.colors.surface,
          color: tokens.colors.textPrimary,
          border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.bodyMedium.fontSize,
        }}
      />
      {error && (
        <span
          role="alert"
          style={{
            fontSize: tokens.typography.caption.fontSize,
            color: tokens.colors.error,
            paddingLeft: tokens.spacing.sm,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- NewSessionButton`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/sidebar/NewSessionButton.tsx packages/web/src/components/sidebar/__tests__/NewSessionButton.test.tsx
git commit -m "feat(web): add NewSessionButton (footer + InlineEdit on click)"
```

---

### Task 22: Add NewWindowButton

**Files:**
- Create: `packages/web/src/components/sidebar/NewWindowButton.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/NewWindowButton.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/sidebar/__tests__/NewWindowButton.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewWindowButton } from '../NewWindowButton';

describe('NewWindowButton', () => {
  it('shows "+ window" label initially', () => {
    render(<NewWindowButton onCreate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /\+ window/ })).toBeInTheDocument();
  });

  it('clicking shows InlineEdit; Enter with text calls onCreate(name)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewWindowButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /\+ window/ }));
    await userEvent.type(screen.getByRole('textbox'), 'logs{Enter}');
    expect(onCreate).toHaveBeenCalledWith('logs');
  });

  it('Enter with empty calls onCreate(undefined)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewWindowButton onCreate={onCreate} />);
    await userEvent.click(screen.getByRole('button', { name: /\+ window/ }));
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledWith(undefined);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- NewWindowButton`
Expected: FAIL

- [ ] **Step 3: Implement NewWindowButton**

Create `packages/web/src/components/sidebar/NewWindowButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme';
import { validateSessionOrWindowName } from '@/lib/validateName';

export interface NewWindowButtonProps {
  onCreate: (name?: string) => void | Promise<void>;
}

export function NewWindowButton({ onCreate }: NewWindowButtonProps) {
  const { tokens } = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const submit = (): void => {
    const trimmed = text.trim();
    if (trimmed === '') {
      void onCreate(undefined);
      setEditing(false);
      setText('');
      return;
    }
    const validationError = validateSessionOrWindowName(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    void onCreate(trimmed);
    setEditing(false);
    setText('');
    setError(null);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          width: '100%',
          padding: tokens.spacing.xs,
          background: 'transparent',
          color: tokens.colors.textMuted,
          border: 'none',
          cursor: 'pointer',
          fontSize: tokens.typography.smallMedium.fontSize,
          textAlign: 'left',
        }}
      >
        + window
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        placeholder="window 名 (空で自動)"
        aria-label="新規 window 名"
        aria-invalid={error ? 'true' : 'false'}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
            setText('');
            setError(null);
          }
        }}
        onBlur={() => {
          setEditing(false);
          setText('');
          setError(null);
        }}
        style={{
          width: '100%',
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
          background: tokens.colors.surface,
          color: tokens.colors.textPrimary,
          border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.smallMedium.fontSize,
        }}
      />
      {error && (
        <span
          role="alert"
          style={{
            fontSize: tokens.typography.caption.fontSize,
            color: tokens.colors.error,
            paddingLeft: tokens.spacing.sm,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -w packages/web -- NewWindowButton`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/sidebar/NewWindowButton.tsx packages/web/src/components/sidebar/__tests__/NewWindowButton.test.tsx
git commit -m "feat(web): add NewWindowButton (per-session inline create)"
```

---

### Task 23: Refactor SessionsListPanel to use new sub-components + states

**Files:**
- Modify: `packages/web/src/components/SessionsListPanel.tsx`
- Modify: `packages/web/src/components/__tests__/SessionsListPanel.test.tsx` (extend)
- Modify: `packages/web/src/components/Sidebar.tsx` (pass new props)
- Modify: `packages/web/src/routes/sessions.tsx` (wire actions)

- [ ] **Step 1: Extend SessionsListPanel test**

Replace `packages/web/src/components/__tests__/SessionsListPanel.test.tsx` body with:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxSession } from '@zenterm/shared';
import { SessionsListPanel } from '../SessionsListPanel';

const sessions: TmuxSession[] = [
  {
    name: 'zen_dev',
    displayName: 'dev',
    created: 1,
    cwd: '/home/me/proj',
    windows: [
      { index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/home/me/proj' },
      { index: 1, name: 'test', active: false, zoomed: false, paneCount: 1, cwd: '/home/me/proj' },
    ],
  },
];

const noopActions = {
  onSelect: vi.fn(),
  onCreateSession: vi.fn(),
  onRenameSession: vi.fn(),
  onRequestDeleteSession: vi.fn(),
  onCreateWindow: vi.fn(),
  onRenameWindow: vi.fn(),
  onRequestDeleteWindow: vi.fn(),
};

describe('SessionsListPanel', () => {
  it('renders session names', () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('clicking a session calls onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByText('dev'));
    expect(onSelect).toHaveBeenCalledWith('dev', undefined);
  });

  it('shows loading state', () => {
    render(
      <SessionsListPanel
        sessions={[]}
        loading
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it('shows empty state when sessions array is empty', () => {
    render(
      <SessionsListPanel
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText(/セッションなし/)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <SessionsListPanel
        sessions={[]}
        loading={false}
        error="boom"
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText(/読み込めませんでした/)).toBeInTheDocument();
  });

  it('expanding a session reveals + window button', async () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    expect(screen.getByRole('button', { name: /\+ window/ })).toBeInTheDocument();
  });

  it('always shows + 新規セッション in footer', () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByRole('button', { name: /新規セッション/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -w packages/web -- SessionsListPanel`
Expected: FAIL (props shape changed; loading/error/empty states missing)

- [ ] **Step 3: Refactor SessionsListPanel**

Replace `packages/web/src/components/SessionsListPanel.tsx` with:

```tsx
import { useState } from 'react';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { SessionRow } from './sidebar/SessionRow';
import { WindowRow } from './sidebar/WindowRow';
import { NewSessionButton } from './sidebar/NewSessionButton';
import { NewWindowButton } from './sidebar/NewWindowButton';

export interface SessionsListPanelProps {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
  onCreateSession: (name?: string) => void | Promise<void>;
  onRenameSession: (currentDisplayName: string, newName: string) => void | Promise<void>;
  onRequestDeleteSession: (session: TmuxSession) => void;
  onCreateWindow: (sessionDisplayName: string, name?: string) => void | Promise<void>;
  onRenameWindow: (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ) => void | Promise<void>;
  onRequestDeleteWindow: (sessionDisplayName: string, window: TmuxWindow) => void;
}

export function SessionsListPanel({
  sessions,
  loading,
  error,
  activeSessionId,
  activeWindowIndex,
  onSelect,
  onCreateSession,
  onRenameSession,
  onRequestDeleteSession,
  onCreateWindow,
  onRenameWindow,
  onRequestDeleteWindow,
}: SessionsListPanelProps) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div
      style={{
        padding: tokens.spacing.md,
        color: tokens.colors.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing.sm,
      }}
    >
      <div
        style={{
          fontSize: tokens.typography.caption.fontSize,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          color: tokens.colors.textMuted,
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        }}
      >
        Active · {sessions.length}
      </div>

      {loading && sessions.length === 0 && (
        <div style={{ padding: tokens.spacing.md, color: tokens.colors.textMuted }}>
          読み込み中…
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: tokens.spacing.md,
            color: tokens.colors.error,
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing.sm,
          }}
        >
          <span>読み込めませんでした: {error}</span>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div
          style={{
            padding: tokens.spacing.lg,
            color: tokens.colors.textMuted,
            textAlign: 'center',
          }}
        >
          セッションなし
        </div>
      )}

      {sessions.map((session) => {
        const isActive = session.displayName === activeSessionId;
        const isExpanded = expanded.has(session.name);
        return (
          <div key={session.name}>
            <SessionRow
              session={session}
              isActive={isActive}
              isExpanded={isExpanded}
              activeWindowIndex={activeWindowIndex}
              onSelect={onSelect}
              onToggleExpand={toggle}
              onRename={onRenameSession}
              onRequestDelete={onRequestDeleteSession}
            />
            {isExpanded && session.windows && (
              <div
                style={{
                  paddingLeft: tokens.spacing.lg,
                  borderLeft: `1px solid ${tokens.colors.borderSubtle}`,
                  marginLeft: tokens.spacing.md,
                }}
              >
                {session.windows.map((w) => {
                  const isWindowActive =
                    isActive && activeWindowIndex === w.index;
                  return (
                    <WindowRow
                      key={w.index}
                      sessionDisplayName={session.displayName}
                      window={w}
                      isActive={isWindowActive}
                      onSelect={() => onSelect(session.displayName, w.index)}
                      onRename={onRenameWindow}
                      onRequestDelete={onRequestDeleteWindow}
                    />
                  );
                })}
                <NewWindowButton
                  onCreate={(name) => onCreateWindow(session.displayName, name)}
                />
              </div>
            )}
          </div>
        );
      })}

      <NewSessionButton onCreate={onCreateSession} />
    </div>
  );
}
```

- [ ] **Step 4: Update Sidebar to forward new props**

Replace `packages/web/src/components/Sidebar.tsx` with:

```tsx
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { SessionsListPanel } from './SessionsListPanel';
import { useTheme } from '@/theme';
import { useEventsStore } from '@/stores/events';

export interface SidebarProps {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
  onCreateSession: (name?: string) => void | Promise<void>;
  onRenameSession: (currentDisplayName: string, newName: string) => void | Promise<void>;
  onRequestDeleteSession: (session: TmuxSession) => void;
  onCreateWindow: (sessionDisplayName: string, name?: string) => void | Promise<void>;
  onRenameWindow: (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ) => void | Promise<void>;
  onRequestDeleteWindow: (sessionDisplayName: string, window: TmuxWindow) => void;
}

const SIDEBAR_WIDTH = 320;

export function Sidebar(props: SidebarProps) {
  const { tokens } = useTheme();
  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        background: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'grid',
        gridTemplateRows: '1fr 56px',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div aria-label="Sessions panel" style={{ overflowY: 'auto' }}>
        <SessionsListPanel {...props} />
      </div>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          borderTop: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Sessions tab"
          aria-pressed="true"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.primary,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'pointer',
            padding: tokens.spacing.sm,
          }}
        >
          ⌘ Sessions
        </button>
        <button
          type="button"
          aria-label="Files tab"
          disabled
          title="Coming in Phase 2b"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          📁 Files
        </button>
        <button
          type="button"
          aria-label="Settings tab"
          disabled
          title="Coming in Phase 2b"
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'not-allowed',
            padding: tokens.spacing.sm,
            opacity: 0.5,
          }}
        >
          ⚙ Settings
        </button>
        <EventsStatusDot />
      </nav>
    </aside>
  );
}

function EventsStatusDot() {
  const { tokens } = useTheme();
  const status = useEventsStore((s) => s.status);
  const attempt = useEventsStore((s) => s.reconnectAttempt);
  const color = (() => {
    switch (status) {
      case 'connected':
        return tokens.colors.success;
      case 'reconnecting':
        return tokens.colors.warning;
      case 'failed':
        return tokens.colors.error;
      default:
        return tokens.colors.textMuted;
    }
  })();
  const label =
    status === 'reconnecting'
      ? `Realtime updates: reconnecting (attempt ${attempt})`
      : `Realtime updates: ${status}`;
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}
```

- [ ] **Step 5: Update Sidebar test for new props shape**

Replace `packages/web/src/components/__tests__/Sidebar.test.tsx` body with:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useEventsStore } from '@/stores/events';

const noopActions = {
  onSelect: vi.fn(),
  onCreateSession: vi.fn(),
  onRenameSession: vi.fn(),
  onRequestDeleteSession: vi.fn(),
  onCreateWindow: vi.fn(),
  onRenameWindow: vi.fn(),
  onRequestDeleteWindow: vi.fn(),
};

describe('Sidebar', () => {
  beforeEach(() => {
    useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
  });

  it('renders sessions panel and bottom nav with 3 buttons', () => {
    render(
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByLabelText(/Sessions panel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sessions tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Files tab/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings tab/i })).toBeDisabled();
  });

  it('shows events status indicator', () => {
    render(
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByLabelText(/Realtime updates/i)).toBeInTheDocument();
  });

  it('reflects connected status', () => {
    useEventsStore.setState({ status: 'connected', reconnectAttempt: 0, lastEvent: null });
    render(
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByLabelText(/Realtime updates: connected/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Wire actions in SessionsRoute**

Replace `packages/web/src/routes/sessions.tsx` with:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { Sidebar } from '@/components/Sidebar';
import { TerminalPane } from '@/components/TerminalPane';
import { ApiClient } from '@/api/client';
import { HttpError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { useEventsSubscription } from '@/hooks/useEventsSubscription';

export function SessionsRoute() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const logout = useAuthStore((s) => s.logout);
  const sessions = useSessionsStore((s) => s.sessions);
  const loading = useSessionsStore((s) => s.loading);
  const error = useSessionsStore((s) => s.error);
  const activeSessionId = useSessionViewStore((s) => s.activeSessionId);
  const activeWindowIndex = useSessionViewStore((s) => s.activeWindowIndex);
  const open = useSessionViewStore((s) => s.open);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const pushToast = useUiStore((s) => s.pushToast);

  useEventsSubscription();

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const client = new ApiClient(gatewayUrl, token);
    useSessionsStore.getState()
      .refetch(client)
      .catch((err) => {
        if (err instanceof HttpError && err.status === 401) {
          logout();
          navigate('/web/login', { replace: true });
        }
      });
  }, [token, gatewayUrl, logout, navigate]);

  if (!token || !gatewayUrl) return null;

  const client = new ApiClient(gatewayUrl, token);

  const handleAuthError = (err: unknown): boolean => {
    if (err instanceof HttpError && err.status === 401) {
      logout();
      navigate('/web/login', { replace: true });
      return true;
    }
    return false;
  };

  const reportMutationError = (err: unknown, action: string): void => {
    if (handleAuthError(err)) return;
    if (err instanceof HttpError && err.status === 404) {
      pushToast({ type: 'error', message: '対象が見つかりません。一覧を更新します' });
      void useSessionsStore.getState().refetch(client);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${action}に失敗: ${message}` });
  };

  const handleCreateSession = async (name?: string): Promise<void> => {
    try {
      await useSessionsStore.getState().create(client, { name });
    } catch (err) {
      reportMutationError(err, 'セッション作成');
    }
  };

  const handleRenameSession = async (
    currentDisplayName: string,
    newName: string,
  ): Promise<void> => {
    try {
      await useSessionsStore.getState().rename(client, currentDisplayName, newName);
    } catch (err) {
      reportMutationError(err, 'セッション名変更');
    }
  };

  const handleRequestDeleteSession = (session: TmuxSession): void => {
    const windowCount = session.windows?.length ?? 0;
    const message =
      windowCount > 0
        ? `${session.displayName} を削除しますか? (window ${windowCount} 個も削除されます)`
        : `${session.displayName} を削除しますか?`;
    showConfirm({
      title: 'セッションを削除',
      message,
      destructive: true,
      onConfirm: async () => {
        try {
          await useSessionsStore.getState().removeSession(client, session.displayName);
        } catch (err) {
          reportMutationError(err, 'セッション削除');
        }
      },
    });
  };

  const handleCreateWindow = async (
    sessionDisplayName: string,
    name?: string,
  ): Promise<void> => {
    try {
      await useSessionsStore.getState().createWindow(client, sessionDisplayName, { name });
    } catch (err) {
      reportMutationError(err, 'window 作成');
    }
  };

  const handleRenameWindow = async (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ): Promise<void> => {
    try {
      await useSessionsStore.getState().renameWindow(client, sessionDisplayName, windowIndex, newName);
    } catch (err) {
      reportMutationError(err, 'window 名変更');
    }
  };

  const handleRequestDeleteWindow = (
    sessionDisplayName: string,
    window: TmuxWindow,
  ): void => {
    showConfirm({
      title: 'window を削除',
      message: `${window.name} を削除しますか?`,
      destructive: true,
      onConfirm: async () => {
        try {
          await useSessionsStore.getState().removeWindow(client, sessionDisplayName, window.index);
        } catch (err) {
          reportMutationError(err, 'window 削除');
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
      <Sidebar
        sessions={sessions}
        loading={loading}
        error={error}
        activeSessionId={activeSessionId}
        activeWindowIndex={activeWindowIndex}
        onSelect={(sessionId, windowIndex) => open(sessionId, windowIndex ?? 0)}
        onCreateSession={handleCreateSession}
        onRenameSession={handleRenameSession}
        onRequestDeleteSession={handleRequestDeleteSession}
        onCreateWindow={handleCreateWindow}
        onRenameWindow={handleRenameWindow}
        onRequestDeleteWindow={handleRequestDeleteWindow}
      />
      <TerminalPane
        gatewayUrl={gatewayUrl}
        token={token}
        sessionId={activeSessionId}
        windowIndex={activeWindowIndex}
      />
    </div>
  );
}
```

- [ ] **Step 7: Run all web tests**

Run: `npm test -w packages/web`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/components/SessionsListPanel.tsx packages/web/src/components/__tests__/SessionsListPanel.test.tsx packages/web/src/components/Sidebar.tsx packages/web/src/components/__tests__/Sidebar.test.tsx packages/web/src/routes/sessions.tsx
git commit -m "$(cat <<'EOF'
feat(web): refactor SessionsListPanel into Row components + states

- SessionsListPanel が SessionRow / WindowRow / NewSessionButton / NewWindowButton を組み合わせるコンテナに
- loading / empty / error 状態を表示
- SessionsRoute から CRUD ハンドラを ConfirmDialog / Toast 経由で wire
EOF
)"
```

---

## Sub-Phase 2a-5: Integration tests (flows)

### Task 24: Session CRUD flow tests

**Files:**
- Create: `packages/web/src/__tests__/flows/session-crud-flow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/__tests__/flows/session-crud-flow.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useEventsStore } from '@/stores/events';

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function () {
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
  useSessionsStore.setState({ sessions: [], loading: false, error: null });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
    return handler(typeof input === 'string' ? input : input.url, init);
  }));
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/web/sessions']}>
      <App />
    </MemoryRouter>,
  );
}

describe('Session CRUD flows', () => {
  it('creates a session via "+ 新規セッション"', async () => {
    const created = { name: 'zen_x', displayName: 'x', created: 1, cwd: '/', windows: [] };
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/api/sessions') && init?.method === 'POST') {
        return new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByRole('button', { name: /新規セッション/ }));
    await userEvent.click(screen.getByRole('button', { name: /新規セッション/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /新規セッション名/ }), 'x{Enter}');

    await waitFor(() => expect(useSessionsStore.getState().sessions).toHaveLength(1));
    expect(useSessionsStore.getState().sessions[0].displayName).toBe('x');
  });

  it('renames a session via kebab → Rename', async () => {
    useSessionsStore.setState({
      sessions: [{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }],
      loading: false,
      error: null,
    });
    const renamed = { name: 'zen_renamed', displayName: 'renamed', created: 1, cwd: '/', windows: [] };
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify([{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/sessions/a') && init?.method === 'PATCH') {
        return new Response(JSON.stringify(renamed), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox', { name: /セッション名を編集/ });
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');

    await waitFor(() =>
      expect(useSessionsStore.getState().sessions[0].displayName).toBe('renamed'),
    );
  });

  it('rename surfacing 409 shows toast (and store unchanged)', async () => {
    useSessionsStore.setState({
      sessions: [{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }],
      loading: false,
      error: null,
    });
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify([{ name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/sessions/a') && init?.method === 'PATCH') {
        return new Response('conflict', { status: 409 });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox', { name: /セッション名を編集/ });
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');

    await waitFor(() => expect(useUiStore.getState().toasts.length).toBeGreaterThan(0));
    expect(useSessionsStore.getState().sessions[0].displayName).toBe('a');
  });

  it('deletes a session through ConfirmDialog → API', async () => {
    useSessionsStore.setState({
      sessions: [
        { name: 'zen_a', displayName: 'a', created: 1, cwd: '/', windows: [] },
        { name: 'zen_b', displayName: 'b', created: 2, cwd: '/', windows: [] },
      ],
      loading: false,
      error: null,
    });
    mockFetch((url, init) => {
      if (url.endsWith('/api/sessions') && (init?.method ?? 'GET') === 'GET') {
        return new Response(
          JSON.stringify([{ name: 'zen_b', displayName: 'b', created: 2, cwd: '/', windows: [] }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions/a') && init?.method === 'DELETE') {
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Actions for session a/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(screen.getByText(/a を削除しますか/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() =>
      expect(useSessionsStore.getState().sessions.map((s) => s.displayName)).toEqual(['b']),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -w packages/web -- session-crud-flow`
Expected: PASS (4/4)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/session-crud-flow.test.tsx
git commit -m "test(web): add session CRUD flow integration tests"
```

---

### Task 25: Window CRUD flow tests

**Files:**
- Create: `packages/web/src/__tests__/flows/window-crud-flow.test.tsx`

- [ ] **Step 1: Write the test**

Create `packages/web/src/__tests__/flows/window-crud-flow.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useEventsStore } from '@/stores/events';
import { useSessionViewStore } from '@/stores/sessionView';

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function () {
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
  useSessionsStore.setState({
    sessions: [
      {
        name: 'zen_a',
        displayName: 'a',
        created: 1,
        cwd: '/',
        windows: [
          { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
          { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
        ],
      },
    ],
    loading: false,
    error: null,
  });
  useSessionViewStore.setState({ activeSessionId: 'a', activeWindowIndex: 0 });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
    return handler(typeof input === 'string' ? input : input.url, init);
  }));
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/web/sessions']}>
      <App />
    </MemoryRouter>,
  );
}

describe('Window CRUD flows', () => {
  it('creates a window via "+ window" inside expanded session', async () => {
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/sessions') && method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              name: 'zen_a',
              displayName: 'a',
              created: 1,
              cwd: '/',
              windows: [
                { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
                { index: 1, name: 'w1', active: false, zoomed: false, paneCount: 1, cwd: '/' },
                { index: 2, name: 'logs', active: false, zoomed: false, paneCount: 1, cwd: '/' },
              ],
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions/a/windows') && method === 'POST') {
        return new Response(
          JSON.stringify({ index: 2, name: 'logs', active: false, zoomed: false, paneCount: 1, cwd: '/' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    await userEvent.click(screen.getByRole('button', { name: /\+ window/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /新規 window 名/ }), 'logs{Enter}');

    await waitFor(() =>
      expect(
        useSessionsStore.getState().sessions[0].windows?.map((w) => w.name),
      ).toContain('logs'),
    );
  });

  it('renames a window via kebab → Rename', async () => {
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/sessions') && method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              name: 'zen_a',
              displayName: 'a',
              created: 1,
              cwd: '/',
              windows: [
                { index: 0, name: 'w0', active: true, zoomed: false, paneCount: 1, cwd: '/' },
                { index: 1, name: 'renamed', active: false, zoomed: false, paneCount: 1, cwd: '/' },
              ],
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions/a/windows/1') && method === 'PATCH') {
        return new Response(
          JSON.stringify({ index: 1, name: 'renamed', active: false, zoomed: false, paneCount: 1, cwd: '/' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    await userEvent.click(screen.getByLabelText(/Actions for window w1/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox', { name: /window 名を編集/ });
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');

    await waitFor(() =>
      expect(
        useSessionsStore.getState().sessions[0].windows?.find((w) => w.index === 1)?.name,
      ).toBe('renamed'),
    );
  });

  it('deletes a window through ConfirmDialog → fallback to next', async () => {
    mockFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/sessions') && method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              name: 'zen_a',
              displayName: 'a',
              created: 1,
              cwd: '/',
              windows: [{ index: 1, name: 'w1', active: true, zoomed: false, paneCount: 1, cwd: '/' }],
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/sessions/a/windows/0') && method === 'DELETE') {
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    renderApp();
    await waitFor(() => screen.getByText('a'));
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    await userEvent.click(screen.getByLabelText(/Actions for window w0/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(screen.getByText(/w0 を削除しますか/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() =>
      expect(useSessionViewStore.getState().activeWindowIndex).toBe(1),
    );
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -w packages/web -- window-crud-flow`
Expected: PASS (3/3)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/window-crud-flow.test.tsx
git commit -m "test(web): add window CRUD flow integration tests"
```

---

### Task 26: Events refetch flow test

**Files:**
- Create: `packages/web/src/__tests__/flows/events-refetch-flow.test.tsx`

- [ ] **Step 1: Write the test**

Create `packages/web/src/__tests__/flows/events-refetch-flow.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useEventsStore } from '@/stores/events';

let lastClientOptions: { onEvent: (e: unknown) => void; onStatusChange: (s: string, a: number) => void } | null = null;

vi.mock('@/lib/events/client', () => ({
  TmuxEventsClient: vi.fn().mockImplementation(function (options: typeof lastClientOptions) {
    lastClientOptions = options;
    return { start: vi.fn(), stop: vi.fn(), triggerReconnect: vi.fn() };
  }),
}));

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => null,
}));

beforeEach(() => {
  lastClientOptions = null;
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://gw:18765' });
  useSessionsStore.setState({ sessions: [], loading: false, error: null });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  useEventsStore.setState({ status: 'idle', reconnectAttempt: 0, lastEvent: null });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('events → refetch flow', () => {
  it('refetches sessions after sessions-changed event (debounced)', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount += 1;
      const sessions =
        callCount === 1
          ? []
          : [{ name: 'zen_x', displayName: 'x', created: 1, cwd: '/', windows: [] }];
      return new Response(JSON.stringify(sessions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(lastClientOptions).not.toBeNull());

    act(() => {
      lastClientOptions!.onStatusChange('connected', 0);
    });
    expect(useEventsStore.getState().status).toBe('connected');

    act(() => {
      lastClientOptions!.onEvent({ type: 'sessions-changed' });
      lastClientOptions!.onEvent({ type: 'sessions-changed' });
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    await waitFor(() =>
      expect(useSessionsStore.getState().sessions.map((s) => s.displayName)).toEqual(['x']),
    );
  });

  it('updates events status indicator on reconnecting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(lastClientOptions).not.toBeNull());
    act(() => {
      lastClientOptions!.onStatusChange('reconnecting', 3);
    });
    expect(screen.getByLabelText(/Realtime updates: reconnecting \(attempt 3\)/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -w packages/web -- events-refetch-flow`
Expected: PASS (2/2)

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/events-refetch-flow.test.tsx
git commit -m "test(web): add events → refetch + status indicator flow test"
```

---

## Sub-Phase 2a-6: E2E + Phase 1 cleanup

### Task 27: E2E sessions-crud.spec.ts

**Files:**
- Create: `tests/e2e/web/sessions-crud.spec.ts`

- [ ] **Step 1: Build the web SPA so gateway serves it**

Run: `npm run build:web && npm run build:gateway`
Expected: SUCCESS (both builds produce dist + public/web/assets)

- [ ] **Step 2: Write the E2E test**

Create `tests/e2e/web/sessions-crud.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4322';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18797\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18797', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18797';

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  // Clean up any sessions created during the test (best-effort)
  try {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.ok) {
      const sessions = (await res.json()) as Array<{ displayName: string }>;
      for (const s of sessions) {
        await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.displayName)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
      }
    }
  } catch {
    /* ignore */
  }
  gateway?.kill();
});

test('creates a session through the sidebar UI', async ({ page }) => {
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible();

  await page.getByRole('button', { name: /新規セッション/ }).click();
  await page.getByRole('textbox', { name: /新規セッション名/ }).fill('e2e_create');
  await page.keyboard.press('Enter');

  await expect(page.getByText('e2e_create')).toBeVisible({ timeout: 5000 });

  const apiList = await fetch(`${baseUrl}/api/sessions`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const sessions = (await apiList.json()) as Array<{ displayName: string }>;
  expect(sessions.some((s) => s.displayName === 'e2e_create')).toBe(true);
});

test('renames a session through kebab menu', async ({ page }) => {
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_rename' }),
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByText('e2e_rename')).toBeVisible();

  await page.getByLabel('Actions for session e2e_rename').click();
  await page.getByRole('menuitem', { name: /Rename/ }).click();
  const input = page.getByRole('textbox', { name: /セッション名を編集/ });
  await input.fill('e2e_renamed');
  await page.keyboard.press('Enter');

  await expect(page.getByText('e2e_renamed')).toBeVisible({ timeout: 5000 });
});

test('deletes a session through kebab → confirm', async ({ page }) => {
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_delete' }),
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByText('e2e_delete')).toBeVisible();

  await page.getByLabel('Actions for session e2e_delete').click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(page.getByText(/e2e_delete を削除しますか/)).toBeVisible();
  await page.getByRole('button', { name: '削除' }).click();

  await expect(page.getByText('e2e_delete')).not.toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 3: Run E2E tests**

Run: `npx playwright test tests/e2e/web/sessions-crud.spec.ts`
Expected: PASS (3/3)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/web/sessions-crud.spec.ts
git commit -m "test(e2e): add session create/rename/delete via sidebar UI"
```

---

### Task 28: E2E windows-crud.spec.ts

**Files:**
- Create: `tests/e2e/web/windows-crud.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/web/windows-crud.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4323';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18796\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18796', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18796';

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.ok) {
      const sessions = (await res.json()) as Array<{ displayName: string }>;
      for (const s of sessions) {
        await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.displayName)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
      }
    }
  } catch {
    /* ignore */
  }
  gateway?.kill();
});

test('creates, renames, and deletes a window in a session', async ({ page }) => {
  // Pre-create a session with one window via API
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_win' }),
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByText('e2e_win')).toBeVisible();

  // Create a second window
  await fetch(`${baseUrl}/api/sessions/e2e_win/windows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'second' }),
  });

  // Wait for events refetch to surface the second window
  await page.waitForTimeout(1000);

  // Now expand the session
  await page.getByLabel(/Expand windows/).click();
  await expect(page.getByRole('button', { name: /\+ window/ })).toBeVisible();

  // Create a new window through the UI
  await page.getByRole('button', { name: /\+ window/ }).click();
  await page.getByRole('textbox', { name: /新規 window 名/ }).fill('logs');
  await page.keyboard.press('Enter');
  await expect(page.getByText('logs')).toBeVisible({ timeout: 5000 });

  // Rename the 'second' window
  await page.getByLabel('Actions for window second').click();
  await page.getByRole('menuitem', { name: /Rename/ }).click();
  const renameInput = page.getByRole('textbox', { name: /window 名を編集/ });
  await renameInput.fill('renamed');
  await page.keyboard.press('Enter');
  await expect(page.getByText('renamed')).toBeVisible({ timeout: 5000 });

  // Delete 'logs' window
  await page.getByLabel('Actions for window logs').click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(page.getByText(/logs を削除しますか/)).toBeVisible();
  await page.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('logs')).not.toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 2: Run E2E test**

Run: `npx playwright test tests/e2e/web/windows-crud.spec.ts`
Expected: PASS (1/1)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/windows-crud.spec.ts
git commit -m "test(e2e): add window create/rename/delete via sidebar UI"
```

---

### Task 29: E2E events-realtime.spec.ts

**Files:**
- Create: `tests/e2e/web/events-realtime.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/web/events-realtime.spec.ts`:

```ts
import { test, expect, type Browser } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4324';

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=18795\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: { ...process.env, HOME: home, PORT: '18795', HOST: '127.0.0.1', AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error' },
    stdio: 'inherit',
  });
  baseUrl = 'http://127.0.0.1:18795';

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.ok) {
      const sessions = (await res.json()) as Array<{ displayName: string }>;
      for (const s of sessions) {
        await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.displayName)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
      }
    }
  } catch {
    /* ignore */
  }
  gateway?.kill();
});

async function loginIn(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /Connect/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible();
  return { context, page };
}

test('session created in tab A appears in tab B via /ws/events', async ({ browser }) => {
  const a = await loginIn(browser);
  const b = await loginIn(browser);
  try {
    await a.page.getByRole('button', { name: /新規セッション/ }).click();
    await a.page.getByRole('textbox', { name: /新規セッション名/ }).fill('e2e_realtime');
    await a.page.keyboard.press('Enter');
    await expect(b.page.getByText('e2e_realtime')).toBeVisible({ timeout: 5000 });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('session renamed in tab A reflects in tab B', async ({ browser }) => {
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e_sync' }),
  });

  const a = await loginIn(browser);
  const b = await loginIn(browser);
  try {
    await expect(a.page.getByText('e2e_sync')).toBeVisible();
    await expect(b.page.getByText('e2e_sync')).toBeVisible();

    await a.page.getByLabel('Actions for session e2e_sync').click();
    await a.page.getByRole('menuitem', { name: /Rename/ }).click();
    const input = a.page.getByRole('textbox', { name: /セッション名を編集/ });
    await input.fill('e2e_synced');
    await a.page.keyboard.press('Enter');

    await expect(b.page.getByText('e2e_synced')).toBeVisible({ timeout: 5000 });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
```

- [ ] **Step 2: Run E2E test**

Run: `npx playwright test tests/e2e/web/events-realtime.spec.ts`
Expected: PASS (2/2)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/events-realtime.spec.ts
git commit -m "test(e2e): add multi-tab events realtime sync test"
```

---

### Task 30: Phase 1 cleanup — XtermView onStatusChange dep + FONT_FAMILY

**Files:**
- Modify: `packages/web/src/theme/tokens.ts` (add FONT_FAMILY export)
- Modify: `packages/web/src/components/terminal/XtermView.tsx` (use FONT_FAMILY from tokens, stabilize onStatusChange)

- [ ] **Step 1: Promote FONT_FAMILY to tokens**

In `packages/web/src/theme/tokens.ts`, add at the very top (before `ColorTokens`):

```ts
export const FONT_FAMILY_MONO =
  '"Noto Sans Mono CJK JP", "Noto Sans Mono", "DejaVu Sans Mono", monospace';
```

Replace the `mono: { fontFamily: ... }` line in both `darkTokens.typography` and `lightTokens.typography` (since `lightTokens.typography = darkTokens.typography`, only one place needs editing). Replace:

```ts
    mono: { fontFamily: '"Noto Sans Mono CJK JP", "Noto Sans Mono", "DejaVu Sans Mono", monospace' },
```

with:

```ts
    mono: { fontFamily: FONT_FAMILY_MONO },
```

- [ ] **Step 2: Use FONT_FAMILY_MONO in XtermView and stabilize callback**

In `packages/web/src/components/terminal/XtermView.tsx`:

Replace lines 31-32 (the local FONT_FAMILY const):

```ts
const FONT_FAMILY =
  '"Noto Sans Mono CJK JP", "Noto Sans Mono", "DejaVu Sans Mono", monospace';
```

with:

```ts
import { FONT_FAMILY_MONO } from '@/theme/tokens';
```

Replace `fontFamily: FONT_FAMILY,` (in the `new Terminal({...})` block) with `fontFamily: FONT_FAMILY_MONO,`.

Now stabilize `onStatusChange` so the WebSocket effect doesn't reconnect on parent re-renders. At the top of the function body, add:

```ts
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);
```

Then in the WebSocket `useEffect`, replace every direct `onStatusChange(...)` call with `onStatusChangeRef.current(...)`. There are 5 call sites inside the WS effect:

```diff
-      onStatusChange('disconnected');
+      onStatusChangeRef.current('disconnected');

       ws.onopen = () => {
         backoffRef.current.reset();
         term.reset();
         fitRef.current?.fit();
         ws.send(encodeResize(term.cols, term.rows));
-        onStatusChange('connected');
+        onStatusChangeRef.current('connected');
       };
       ...
         } else if (msg.type === 'error') {
-          onStatusChange('error');
+          onStatusChangeRef.current('error');
         }
       ...
         if (ev.code === 1000 || ev.code === 1008) {
-          onStatusChange('disconnected');
+          onStatusChangeRef.current('disconnected');
           return;
         }
         ...
         if (step.exhausted) {
-          onStatusChange('error');
+          onStatusChangeRef.current('error');
           return;
         }
-        onStatusChange('reconnecting');
+        onStatusChangeRef.current('reconnecting');
       ...
-      ws.onerror = () => onStatusChange('error');
+      ws.onerror = () => onStatusChangeRef.current('error');
```

Finally, remove `onStatusChange` from the WebSocket effect's dependency array. Change:

```ts
  }, [gatewayUrl, token, sessionId, windowIndex, onStatusChange]);
```

to:

```ts
  }, [gatewayUrl, token, sessionId, windowIndex]);
```

- [ ] **Step 3: Run web tests to verify nothing broke**

Run: `npm test -w packages/web`
Expected: ALL PASS (existing XtermView test still mocks WS so it should be fine)

Run: `npm run build -w packages/web`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/theme/tokens.ts packages/web/src/components/terminal/XtermView.tsx
git commit -m "$(cat <<'EOF'
fix(web): centralize FONT_FAMILY_MONO and stabilize XtermView onStatusChange

Phase 1 残課題 2 件:
- FONT_FAMILY 重複を theme/tokens.ts に集約 (FONT_FAMILY_MONO export)
- onStatusChange ref 化で WS effect 依存配列から除外、不要な再接続を防止
EOF
)"
```

---

## 完了条件

Phase 2a は以下を満たして tag `web-pc-phase-2a-done` を打つ:

- [ ] 全 30 タスクの commit が積まれている
- [ ] `npm test -w packages/web` で 全 PASS (既存 59 + Phase 2a 追加 60+ = 110+ tests)
- [ ] `npm test -w packages/gateway` で 全 PASS (既存 143 tests)
- [ ] `npm run build -w packages/gateway` / `npm run build -w packages/web` 両方成功
- [ ] `npx playwright test` で Phase 1 既存 3 件 + Phase 2a 追加 6 件 全 PASS
- [ ] ブラウザ実機 (Chrome) でログイン → セッション作成 → window 追加 → rename → delete を目視確認
- [ ] 別ブラウザ context (シークレットウィンドウ等) を開いて events 経由の反映を目視確認

最後に tag を打つ:

```bash
git tag web-pc-phase-2a-done
```

---

## 自己レビュー記録

**Spec coverage:**
- ✅ events 購読: Tasks 1-6
- ✅ session CRUD: Tasks 7, 10, 27 (E2E)
- ✅ window CRUD: Tasks 8, 11, 28 (E2E)
- ✅ Sidebar 完成 (kebab + inline edit + create): Tasks 14, 15, 17, 19-23
- ✅ ConfirmDialog: Tasks 15, 18
- ✅ Toast: Tasks 16, 18
- ✅ validation: Task 13
- ✅ a11y (role/aria): 各 component test 内で確認
- ✅ Phase 1 残課題 2 件: Task 30
- ✅ flow tests: Tasks 24-26
- ✅ E2E: Tasks 27-29

**Type 一貫性:**
- `SessionsApiClient` interface (Task 9 で初出、Task 10 で拡張、Task 11 でさらに拡張) — `Pick<SessionsApiClient, ...>` で必要メソッドだけ受け取る形を一貫
- `useSessionsStore.removeSession` (Task 10) と `useSessionsStore.removeWindow` (Task 11) — 命名揃え
- `RowActionsMenu` items の `destructive?: boolean` — Tasks 17, 19, 20 で一貫使用
- `ConfirmDialogConfig` — Tasks 12, 15, 18 で同じ shape

**Placeholder scan:**
- 該当なし。すべての code step に完全なコードを記載済み。





