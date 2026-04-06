import type { FastifyPluginAsync } from 'fastify';
import type {
  AgentEvent,
  AgentType,
  DeviceRegistration,
  IntegrationStatus,
  TestNotificationResponse,
} from '@zenterm/shared';
import {
  addDevice,
  addEvent,
  getDevices,
  getIntegrations,
  hasDevices,
  removeDevice,
  setIntegrationStatus,
  updateLastEvent,
} from '../services/notification-store.js';
import { sendPushNotifications, sendTestNotification } from '../services/push.js';

// Lazy-import integration installer (may not exist yet during early dev)
async function getInstaller() {
  const mod = await import('../services/integration-installer.js');
  return mod;
}

const VALID_AGENT_TYPES = new Set<string>([
  'claude-code',
  'codex',
  'copilot-cli',
  'unknown',
]);

const VALID_EVENT_TYPES = new Set<string>([
  'task.completed',
  'task.failed',
  'input.requested',
  'session.ended',
]);

// ── Agent Events ─────────────────────────────────────

const notificationRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/agent-events — hook スクリプトからのイベント受信
  app.post('/api/agent-events', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // Validate required fields
    const type = String(body.type ?? '');
    const agent = String(body.agent ?? 'unknown');

    if (!VALID_EVENT_TYPES.has(type)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid event type: ${type}`,
      });
    }

    if (!VALID_AGENT_TYPES.has(agent)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid agent type: ${agent}`,
      });
    }

    const event: AgentEvent = {
      type: type as AgentEvent['type'],
      agent: agent as AgentType,
      sessionId: body.sessionId ? String(body.sessionId) : undefined,
      summary: body.summary ? String(body.summary) : undefined,
      cwd: body.cwd ? String(body.cwd) : undefined,
      exitCode: typeof body.exitCode === 'number' ? body.exitCode : undefined,
      timestamp: typeof body.timestamp === 'number' ? body.timestamp : Date.now(),
    };

    // Record event
    addEvent(event);
    updateLastEvent(event.agent, event.timestamp);

    // Send push notifications
    const tokens = getDevices().map((d) => d.token);
    const result = await sendPushNotifications(tokens, event);

    request.log.info(
      { agent: event.agent, type: event.type, sent: result.sent },
      'agent event processed',
    );

    return { ok: true, sent: result.sent };
  });

  // ── Device Management ────────────────────────────────

  // POST /api/notifications/devices — デバイストークン登録
  app.post(
    '/api/notifications/devices',
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const token = String(body.token ?? '');
      const platform = String(body.platform ?? '');

      if (!token) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'token is required',
        });
      }
      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'token must be a valid Expo push token',
        });
      }
      if (platform !== 'ios' && platform !== 'android') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'platform must be ios or android',
        });
      }

      const device: DeviceRegistration = {
        token,
        platform,
        deviceName: body.deviceName ? String(body.deviceName) : undefined,
        registeredAt: Date.now(),
      };

      addDevice(device);
      request.log.info({ token: token.slice(0, 20) + '...' }, 'device registered');

      return { ok: true };
    },
  );

  // GET /api/notifications/devices — 登録済みデバイス一覧
  app.get('/api/notifications/devices', async () => {
    return getDevices();
  });

  // DELETE /api/notifications/devices/:token — デバイストークン削除
  app.delete<{ Params: { token: string } }>(
    '/api/notifications/devices/:token',
    async (request, reply) => {
      const { token } = request.params;
      const removed = removeDevice(decodeURIComponent(token));
      if (!removed) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Device not found',
        });
      }
      return { ok: true };
    },
  );

  // ── Integration Management ───────────────────────────

  // GET /api/integrations — 連携ステータス一覧
  app.get('/api/integrations', async () => {
    return getIntegrations();
  });

  // POST /api/integrations/install — hook 自動インストール
  app.post(
    '/api/integrations/install',
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const agent = String(body.agent ?? '');

      if (!VALID_AGENT_TYPES.has(agent) || agent === 'unknown') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid agent: ${agent}`,
        });
      }

      try {
        const installer = await getInstaller();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await installer.installHook(agent as any);
        if (!result.success) {
          request.log.error({ agent, message: result.message }, 'integration install failed');
          return reply.status(500).send({
            error: 'Install Failed',
            message: result.message,
          });
        }
        setIntegrationStatus(agent as AgentType, {
          installed: true,
          configPath: result.configPath,
        });
        return { ok: true, configPath: result.configPath };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        request.log.error({ agent, error: msg }, 'integration install failed');
        return reply.status(500).send({
          error: 'Install Failed',
          message: msg,
        });
      }
    },
  );

  // POST /api/integrations/uninstall — hook 自動アンインストール
  app.post(
    '/api/integrations/uninstall',
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const agent = String(body.agent ?? '');

      if (!VALID_AGENT_TYPES.has(agent) || agent === 'unknown') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid agent: ${agent}`,
        });
      }

      try {
        const installer = await getInstaller();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await installer.uninstallHook(agent as any);
        setIntegrationStatus(agent as AgentType, { installed: false });
        return { ok: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        request.log.error({ agent, error: msg }, 'integration uninstall failed');
        return reply.status(500).send({
          error: 'Uninstall Failed',
          message: msg,
        });
      }
    },
  );

  // ── Test ──────────────────────────────────────────────

  // POST /api/notifications/test — テスト通知送信
  app.post('/api/notifications/test', async (): Promise<TestNotificationResponse> => {
    const devices = getDevices();
    if (devices.length === 0) {
      return { ok: false, deviceCount: 0 };
    }

    const tokens = devices.map((d) => d.token);
    const result = await sendTestNotification(tokens);

    return { ok: result.sent > 0, deviceCount: result.sent };
  });
};

export default notificationRoutes;
