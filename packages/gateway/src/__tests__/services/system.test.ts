import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import os from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  default: {
    totalmem: vi.fn(),
    freemem: vi.fn(),
    cpus: vi.fn(),
    loadavg: vi.fn(),
    uptime: vi.fn(),
  },
}));

const execFileSyncMock = vi.mocked(childProcess.execFileSync);
const readFileSyncMock = vi.mocked(fs.readFileSync);
const totalmemMock = vi.mocked(os.totalmem);
const freememMock = vi.mocked(os.freemem);
const cpusMock = vi.mocked(os.cpus);
const loadavgMock = vi.mocked(os.loadavg);
const uptimeMock = vi.mocked(os.uptime);

async function loadSystemModule() {
  return import('../../services/system.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('system service', () => {
  it('getSystemStatus: CPU/Memory/Disk/Temperature/Uptime を返す', async () => {
    const { getSystemStatus } = await loadSystemModule();

    totalmemMock.mockReturnValue(8000);
    freememMock.mockReturnValue(3000);
    cpusMock.mockReturnValue([
      { model: 'Fallback CPU' },
      { model: 'Fallback CPU' },
      { model: 'Fallback CPU' },
      { model: 'Fallback CPU' },
    ] as ReturnType<typeof os.cpus>);
    loadavgMock.mockReturnValue([0.5, 0.25, 0.1]);
    uptimeMock.mockReturnValue(3600);
    readFileSyncMock.mockImplementation((...rawArgs: unknown[]) => {
      const target = rawArgs[0] as string;

      switch (target) {
        case '/proc/stat':
          return 'cpu  10 0 20 30 0 0 0 0 0 0\n';
        case '/proc/cpuinfo':
          return 'Model\t: Raspberry Pi 5';
        case '/sys/class/thermal/thermal_zone0/temp':
          return '51234';
        default:
          throw new Error(`Unexpected read path: ${target}`);
      }
    });
    execFileSyncMock.mockReturnValue('1B-blocks Used Available\n1000 400 600\n');

    expect(getSystemStatus()).toEqual({
      cpu: {
        usage: 0,
        cores: 4,
        model: 'Raspberry Pi 5',
        loadAvg: [0.5, 0.25, 0.1],
      },
      memory: {
        total: 8000,
        used: 5000,
        free: 3000,
        percent: 62.5,
      },
      disk: {
        total: 1000,
        used: 400,
        free: 600,
        percent: 40,
      },
      temperature: 51.2,
      uptime: 3600,
    });
  });

  it('getSystemStatus: 温度取得失敗時は null を返す', async () => {
    const { getSystemStatus } = await loadSystemModule();

    totalmemMock.mockReturnValue(4000);
    freememMock.mockReturnValue(1000);
    cpusMock.mockReturnValue([{ model: 'Fallback CPU' }] as ReturnType<typeof os.cpus>);
    loadavgMock.mockReturnValue([0, 0, 0]);
    uptimeMock.mockReturnValue(1800);
    readFileSyncMock.mockImplementation((...rawArgs: unknown[]) => {
      const target = rawArgs[0] as string;

      switch (target) {
        case '/proc/stat':
          return 'cpu  1 0 1 10 0 0 0 0 0 0\n';
        case '/proc/cpuinfo':
          return 'Model\t: Raspberry Pi 5';
        case '/sys/class/thermal/thermal_zone0/temp':
          throw new Error('thermal unavailable');
        default:
          throw new Error(`Unexpected read path: ${target}`);
      }
    });
    execFileSyncMock.mockReturnValue('1B-blocks Used Available\n2000 500 1500\n');

    expect(getSystemStatus().temperature).toBeNull();
  });
});
