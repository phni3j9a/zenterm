import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import type { SystemStatus } from '../types/index.js';

const PROC_STAT_PATH = '/proc/stat';
const THERMAL_PATH = '/sys/class/thermal/thermal_zone0/temp';
const CPUINFO_PATH = '/proc/cpuinfo';

interface CpuTimes {
  idle: number;
  total: number;
}

let previousCpuTimes: CpuTimes | null = null;

function readCpuTimes(): CpuTimes {
  try {
    const content = readFileSync(PROC_STAT_PATH, 'utf8');
    const cpuLine = content.split('\n').find((line) => line.startsWith('cpu '));

    if (!cpuLine) {
      return { idle: 0, total: 0 };
    }

    const values = cpuLine.split(/\s+/).slice(1).map(Number);
    const idle = values[3] ?? 0;
    const total = values.reduce((sum, v) => sum + v, 0);

    return { idle, total };
  } catch {
    return { idle: 0, total: 0 };
  }
}

function calculateCpuUsage(): number {
  const current = readCpuTimes();

  if (!previousCpuTimes) {
    previousCpuTimes = current;
    return 0;
  }

  const idleDelta = current.idle - previousCpuTimes.idle;
  const totalDelta = current.total - previousCpuTimes.total;
  previousCpuTimes = current;

  if (totalDelta <= 0) {
    return 0;
  }

  return Math.round(((totalDelta - idleDelta) / totalDelta) * 100 * 10) / 10;
}

function getCpuModel(): string {
  try {
    const content = readFileSync(CPUINFO_PATH, 'utf8');
    const modelLine = content.split('\n').find((line) => line.startsWith('Model\t') || line.startsWith('model name'));

    if (!modelLine) {
      return os.cpus()[0]?.model ?? 'Unknown';
    }

    return modelLine.split(':').slice(1).join(':').trim();
  } catch {
    return os.cpus()[0]?.model ?? 'Unknown';
  }
}

function getTemperature(): number | null {
  try {
    const content = readFileSync(THERMAL_PATH, 'utf8').trim();
    const millidegrees = Number.parseInt(content, 10);

    if (Number.isNaN(millidegrees)) {
      return null;
    }

    return Math.round(millidegrees / 100) / 10;
  } catch {
    return null;
  }
}

function getDiskUsage(): { total: number; used: number; free: number; percent: number } {
  try {
    const output = execFileSync('df', ['-B1', '--output=size,used,avail', '/'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const lines = output.trim().split('\n');
    const dataLine = lines[1]?.trim();

    if (!dataLine) {
      return { total: 0, used: 0, free: 0, percent: 0 };
    }

    const [totalStr, usedStr, freeStr] = dataLine.split(/\s+/);
    const total = Number.parseInt(totalStr, 10);
    const used = Number.parseInt(usedStr, 10);
    const free = Number.parseInt(freeStr, 10);

    const percent = total > 0 ? Math.round((used / total) * 100 * 10) / 10 : 0;

    return { total, used, free, percent };
  } catch {
    return { total: 0, used: 0, free: 0, percent: 0 };
  }
}

export function getSystemStatus(): SystemStatus {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    cpu: {
      usage: calculateCpuUsage(),
      cores: os.cpus().length,
      model: getCpuModel(),
      loadAvg: os.loadavg()
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: Math.round((usedMem / totalMem) * 100 * 10) / 10
    },
    disk: getDiskUsage(),
    temperature: getTemperature(),
    uptime: os.uptime()
  };
}
