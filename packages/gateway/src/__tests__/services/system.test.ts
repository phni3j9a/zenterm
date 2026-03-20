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
    platform: vi.fn(),
  },
}));

const execFileSyncMock = vi.mocked(childProcess.execFileSync);
const readFileSyncMock = vi.mocked(fs.readFileSync);
const totalmemMock = vi.mocked(os.totalmem);
const freememMock = vi.mocked(os.freemem);
const cpusMock = vi.mocked(os.cpus);
const loadavgMock = vi.mocked(os.loadavg);
const uptimeMock = vi.mocked(os.uptime);
const platformMock = vi.mocked(os.platform);

async function loadSystemModule() {
  return import('../../services/system.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('system service — Linux', () => {
  beforeEach(() => {
    platformMock.mockReturnValue('linux');
  });

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

describe('system service — macOS', () => {
  beforeEach(() => {
    platformMock.mockReturnValue('darwin');
  });

  it('getSystemStatus: os.cpus() ベースの CPU 使用率を返す', async () => {
    const { getSystemStatus } = await loadSystemModule();

    totalmemMock.mockReturnValue(16000);
    freememMock.mockReturnValue(8000);
    const mockCpus = [
      { model: 'Apple M2', times: { user: 100, nice: 0, sys: 50, idle: 300, irq: 0 } },
      { model: 'Apple M2', times: { user: 80, nice: 0, sys: 40, idle: 320, irq: 0 } },
    ] as ReturnType<typeof os.cpus>;
    cpusMock.mockReturnValue(mockCpus);
    loadavgMock.mockReturnValue([1.5, 1.0, 0.5]);
    uptimeMock.mockReturnValue(7200);
    execFileSyncMock.mockReturnValue(
      'Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/disk1s1 500000000 200000000 300000000 40% 1000 4000 20% /\n'
    );

    const status = getSystemStatus();

    // First call → usage 0 (no previous data)
    expect(status.cpu.usage).toBe(0);
    expect(status.cpu.cores).toBe(2);
    expect(status.cpu.model).toBe('Apple M2');
    expect(status.memory.total).toBe(16000);
    expect(status.memory.used).toBe(8000);
    expect(status.temperature).toBeNull();
    expect(status.disk.total).toBe(500000000 * 1024);
    expect(status.disk.used).toBe(200000000 * 1024);
    expect(status.disk.free).toBe(300000000 * 1024);
  });

  it('getSystemStatus: /proc を読まず os.cpus() モデルを使う', async () => {
    const { getSystemStatus } = await loadSystemModule();

    totalmemMock.mockReturnValue(8000);
    freememMock.mockReturnValue(4000);
    cpusMock.mockReturnValue([
      { model: 'Apple M1', times: { user: 50, nice: 0, sys: 25, idle: 200, irq: 0 } },
    ] as ReturnType<typeof os.cpus>);
    loadavgMock.mockReturnValue([0.2, 0.1, 0.05]);
    uptimeMock.mockReturnValue(3600);
    execFileSyncMock.mockReturnValue(
      'Filesystem 1024-blocks Used Available Capacity\n/dev/disk1s1 1000 400 600 40%\n'
    );

    const status = getSystemStatus();

    expect(status.cpu.model).toBe('Apple M1');
    // readFileSync should NOT be called for /proc paths on macOS
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it('getSystemStatus: df -k 出力を正しくパースする', async () => {
    const { getSystemStatus } = await loadSystemModule();

    totalmemMock.mockReturnValue(8000);
    freememMock.mockReturnValue(4000);
    cpusMock.mockReturnValue([
      { model: 'Apple M2', times: { user: 10, nice: 0, sys: 5, idle: 85, irq: 0 } },
    ] as ReturnType<typeof os.cpus>);
    loadavgMock.mockReturnValue([0, 0, 0]);
    uptimeMock.mockReturnValue(100);
    execFileSyncMock.mockReturnValue(
      'Filesystem 1024-blocks Used Available Capacity\n/dev/disk3s1 1000 700 300 70%\n'
    );

    const status = getSystemStatus();

    expect(status.disk).toEqual({
      total: 1000 * 1024,
      used: 700 * 1024,
      free: 300 * 1024,
      percent: 70,
    });
  });
});
