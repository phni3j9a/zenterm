import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AgentEvent,
  AgentType,
  DeviceRegistration,
  IntegrationStatus,
} from '@zenterm/shared';

const MAX_RECENT_EVENTS = 100;

const configDir = join(process.env.HOME ?? '', '.config', 'zenterm');
const storePath = join(configDir, 'notifications.json');

interface StoreData {
  devices: DeviceRegistration[];
  integrations: Record<string, IntegrationStatus>;
  recentEvents: AgentEvent[];
}

function createDefaultStore(): StoreData {
  return {
    devices: [],
    integrations: {},
    recentEvents: [],
  };
}

let store: StoreData = createDefaultStore();

function save(): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

export function loadStore(): void {
  if (!existsSync(storePath)) {
    store = createDefaultStore();
    return;
  }

  try {
    const raw = readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;

    store = {
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      integrations:
        parsed.integrations && typeof parsed.integrations === 'object'
          ? parsed.integrations
          : {},
      recentEvents: Array.isArray(parsed.recentEvents)
        ? parsed.recentEvents.slice(-MAX_RECENT_EVENTS)
        : [],
    };
  } catch {
    // Corrupted file — reset to defaults
    store = createDefaultStore();
  }
}

// --- Device management ---

export function getDevices(): DeviceRegistration[] {
  return store.devices;
}

export function addDevice(device: DeviceRegistration): void {
  const existing = store.devices.findIndex((d) => d.token === device.token);
  if (existing !== -1) {
    store.devices[existing] = device;
  } else {
    store.devices.push(device);
  }
  save();
}

export function removeDevice(token: string): boolean {
  const index = store.devices.findIndex((d) => d.token === token);
  if (index === -1) {
    return false;
  }
  store.devices.splice(index, 1);
  save();
  return true;
}

export function hasDevices(): boolean {
  return store.devices.length > 0;
}

// --- Event recording ---

export function addEvent(event: AgentEvent): void {
  store.recentEvents.push(event);
  if (store.recentEvents.length > MAX_RECENT_EVENTS) {
    store.recentEvents = store.recentEvents.slice(-MAX_RECENT_EVENTS);
  }
  save();
}

export function getRecentEvents(limit?: number): AgentEvent[] {
  if (limit === undefined) {
    return store.recentEvents;
  }
  return store.recentEvents.slice(-limit);
}

// --- Integration status ---

export function getIntegrations(): Record<string, IntegrationStatus> {
  return store.integrations;
}

export function setIntegrationStatus(
  agent: AgentType,
  status: Partial<IntegrationStatus>,
): void {
  const current = store.integrations[agent];
  store.integrations[agent] = {
    ...current,
    ...status,
    agent,
    installed: status.installed ?? current?.installed ?? false,
    configPath: status.configPath ?? current?.configPath ?? '',
  };
  save();
}

export function updateLastEvent(agent: AgentType, timestamp: number): void {
  const current = store.integrations[agent];
  if (current) {
    current.lastEvent = timestamp;
  } else {
    store.integrations[agent] = {
      agent,
      installed: false,
      configPath: '',
      lastEvent: timestamp,
    };
  }
  save();
}
