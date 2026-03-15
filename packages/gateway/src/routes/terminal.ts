import type { FastifyPluginAsync } from 'fastify';
import type { IPty } from 'node-pty';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { config } from '../config.js';
import {
  attachSession,
  createSession,
  getSession,
  sessionExists,
  TmuxServiceError
} from '../services/tmux.js';
import type { ClientMessage, ServerMessage, TmuxSession } from '../types/index.js';

const terminalQuerySchema = z.object({
  sessionId: z.string().trim().min(1).max(64).optional(),
  token: z.string().trim().min(1)
});

const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('input'),
    data: z.string().max(16384) // 16KB max input per message
  }),
  z.object({
    type: z.literal('resize'),
    cols: z.number().int().min(1).max(1000),
    rows: z.number().int().min(1).max(1000)
  }),
  z.object({
    type: z.literal('signal'),
    signal: z.string().trim().min(1).max(32)
  })
]);

const deviceAttributesPattern = /\x1b\[[?>]?[0-9;]*c/gu;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unknown error';
}

function sendMessage(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function parseClientMessage(data: WebSocket.RawData): ClientMessage {
  const payload = typeof data === 'string' ? data : data.toString();
  return clientMessageSchema.parse(JSON.parse(payload));
}

const terminalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws/terminal', { websocket: true }, (socket, request) => {
    let ptyProcess: IPty | null = null;
    let currentSession: TmuxSession | null = null;
    let cleanedUp = false;

    const cleanup = (): void => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;

      if (!ptyProcess) {
        return;
      }

      try {
        ptyProcess.kill();
      } catch (error) {
        request.log.debug({ err: error, session: currentSession?.name }, 'pty cleanup skipped');
      } finally {
        ptyProcess = null;
      }
    };

    const fail = (message: string, closeCode = 1008): void => {
      sendMessage(socket, { type: 'error', message });

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(closeCode, message.slice(0, 123));
      }

      cleanup();
    };

    let query: z.infer<typeof terminalQuerySchema>;
    try {
      query = terminalQuerySchema.parse(request.query);
    } catch (error) {
      request.log.warn({ err: error }, 'invalid terminal websocket query');
      fail('Invalid terminal request');
      return;
    }

    if (query.token !== config.AUTH_TOKEN) {
      request.log.warn({ sessionId: query.sessionId }, 'terminal websocket rejected');
      fail('Unauthorized');
      return;
    }

    try {
      currentSession = query.sessionId
        ? sessionExists(query.sessionId)
          ? (getSession(query.sessionId) ?? createSession(query.sessionId))
          : createSession(query.sessionId)
        : createSession();

      ptyProcess = attachSession(currentSession.name);
    } catch (error) {
      request.log.error({ err: error, sessionId: query.sessionId }, 'terminal attach failed');
      fail(
        toErrorMessage(error),
        error instanceof TmuxServiceError && error.statusCode < 500 ? 1008 : 1011
      );
      return;
    }

    request.log.info({ session: currentSession.name }, 'terminal websocket attached');
    sendMessage(socket, { type: 'sessionInfo', session: currentSession });

    ptyProcess.onData((data) => {
      const filtered = data.replace(deviceAttributesPattern, '');
      if (!filtered) {
        return;
      }

      sendMessage(socket, { type: 'output', data: filtered });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      request.log.info(
        { session: currentSession?.name, exitCode, signal },
        'terminal pty exited'
      );

      sendMessage(socket, {
        type: 'exit',
        code: exitCode,
        signal
      });

      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'PTY exited');
      }

      cleanup();
    });

    socket.on('message', (rawData) => {
      if (!ptyProcess) {
        return;
      }

      let message: ClientMessage;
      try {
        message = parseClientMessage(rawData);
      } catch (error) {
        sendMessage(socket, { type: 'error', message: 'Invalid message payload' });
        request.log.debug({ err: error }, 'invalid terminal websocket payload');
        return;
      }

      try {
        switch (message.type) {
          case 'input':
            ptyProcess.write(message.data);
            break;
          case 'resize':
            ptyProcess.resize(message.cols, message.rows);
            break;
          case 'signal':
            ptyProcess.kill(message.signal);
            break;
        }
      } catch (error) {
        request.log.warn(
          { err: error, session: currentSession?.name, messageType: message.type },
          'terminal websocket command failed'
        );
        sendMessage(socket, { type: 'error', message: toErrorMessage(error) });
      }
    });

    socket.on('close', () => {
      request.log.info({ session: currentSession?.name }, 'terminal websocket closed');
      cleanup();
    });

    socket.on('error', (error) => {
      request.log.warn({ err: error, session: currentSession?.name }, 'terminal websocket error');
      cleanup();
    });
  });
};

export default terminalRoutes;
