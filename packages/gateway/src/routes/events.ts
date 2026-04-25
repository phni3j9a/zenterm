import type { FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { config } from '../config.js';
import { tmuxControlService, type TmuxEvent } from '../services/tmuxControl.js';

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_STALE_MS = 60_000;

const querySchema = z.object({
  token: z.string().trim().min(1)
});

function send(socket: WebSocket, event: TmuxEvent): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(event));
}

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws/events', { websocket: true }, (socket, request) => {
    let unsubscribe: (() => void) | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let lastPongAt = Date.now();
    let cleanedUp = false;

    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    const fail = (message: string, closeCode = 1008): void => {
      try {
        socket.send(JSON.stringify({ type: 'error', message }));
      } catch {
        // ignore
      }
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(closeCode, message.slice(0, 123));
      }
      cleanup();
    };

    let query: z.infer<typeof querySchema>;
    try {
      query = querySchema.parse(request.query);
    } catch (error) {
      request.log.warn({ err: error }, 'invalid events websocket query');
      fail('Invalid events request');
      return;
    }

    if (query.token !== config.AUTH_TOKEN) {
      request.log.warn({ receivedLength: query.token?.length }, 'events websocket rejected');
      fail('Unauthorized');
      return;
    }

    unsubscribe = tmuxControlService.subscribe((event) => {
      send(socket, event);
    });

    socket.on('pong', () => {
      lastPongAt = Date.now();
    });

    heartbeatTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      const elapsed = Date.now() - lastPongAt;
      if (elapsed >= HEARTBEAT_STALE_MS) {
        request.log.warn({ elapsed }, 'events websocket heartbeat stale');
        socket.close();
        cleanup();
        return;
      }
      try {
        socket.ping();
      } catch (error) {
        request.log.debug({ err: error }, 'events websocket ping failed');
        socket.close();
        cleanup();
      }
    }, HEARTBEAT_INTERVAL_MS);

    socket.on('close', () => {
      cleanup();
    });

    socket.on('error', (error) => {
      request.log.warn({ err: error }, 'events websocket error');
      cleanup();
    });
  });
};

export default eventsRoutes;
