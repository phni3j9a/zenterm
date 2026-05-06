import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { buildLaunchdPlist, buildSystemdUnit, setupLinux, setupMacOS } from '../setup.js';

const writeFileSyncMock = vi.mocked(fs.writeFileSync);
const mkdirSyncMock = vi.mocked(fs.mkdirSync);
const execSyncMock = vi.mocked(childProcess.execSync);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// setup.ts は __dirname (= 自身が置かれているディレクトリ) と process.execPath から
// CLI / package のパスを組み立てる。テスト実行時、setup.ts の __dirname は
// このテストの一つ上のディレクトリ (src/) になる。
const SETUP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_CLI_PATH = join(SETUP_DIR, 'cli.js');
const EXPECTED_PACKAGE_DIR = join(SETUP_DIR, '..');

describe('buildSystemdUnit', () => {
  const params = {
    nodePath: '/usr/bin/node',
    cliPath: '/home/me/.npm-global/lib/node_modules/zenterm-gateway/dist/cli.js',
    packageDir: '/home/me/.npm-global/lib/node_modules/zenterm-gateway',
    pathEnv: '/usr/local/bin:/usr/bin:/bin',
  } as const;

  it('KillMode=process を [Service] セクション内に含む — 他のセクションでは効かない', () => {
    const unit = buildSystemdUnit(params);
    // [Service] セクションだけを取り出し、その中に KillMode=process があることを確認する。
    // 他のセクションに紛れ込むと systemd が無視するので、セクション境界を厳密に検証する。
    const sections = unit.split(/\n(?=\[)/);
    const serviceSection = sections.find((s) => s.startsWith('[Service]'));
    expect(serviceSection).toBeDefined();
    expect(serviceSection!).toMatch(/^KillMode=process$/m);

    const installSection = sections.find((s) => s.startsWith('[Install]')) ?? '';
    expect(installSection).not.toMatch(/KillMode/);
  });

  it('与えられたパスから ExecStart / WorkingDirectory を組み立てる', () => {
    const unit = buildSystemdUnit(params);
    expect(unit).toContain(`ExecStart=${params.nodePath} ${params.cliPath}`);
    expect(unit).toContain(`WorkingDirectory=${params.packageDir}`);
    expect(unit).toContain(`Environment=PATH=${params.pathEnv}`);
  });

  it('Restart=always と RestartSec を指定する', () => {
    const unit = buildSystemdUnit(params);
    expect(unit).toMatch(/^Restart=always$/m);
    expect(unit).toMatch(/^RestartSec=5$/m);
  });

  it('[Install] WantedBy=default.target を含む（ユーザーサービス想定）', () => {
    const unit = buildSystemdUnit(params);
    expect(unit).toMatch(/\[Install\][\s\S]*WantedBy=default\.target/);
  });
});

describe('setupLinux', () => {
  const originalHome = process.env.HOME;
  const originalUser = process.env.USER;
  const originalPath = process.env.PATH;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = '/home/testuser';
    process.env.USER = 'testuser';
    process.env.PATH = '/usr/bin:/bin';
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USER = originalUser;
    process.env.PATH = originalPath;
  });

  it('生成した unit ファイルを ~/.config/systemd/user に書き込み、ExecStart/WorkingDirectory/PATH/KillMode が正しく埋まる', () => {
    setupLinux();

    expect(mkdirSyncMock).toHaveBeenCalledWith('/home/testuser/.config/systemd/user', {
      recursive: true,
    });

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [writePath, writeContent] = writeFileSyncMock.mock.calls[0];
    expect(writePath).toBe('/home/testuser/.config/systemd/user/zenterm-gateway.service');
    expect(typeof writeContent).toBe('string');
    const unit = writeContent as string;

    // 実行時パスは setupLinux() が解決して埋め込む。間違うと service が起動できないので
    // setup.ts の __dirname から導出した期待値で完全一致を検証する。
    expect(unit).toMatch(
      new RegExp(
        `^ExecStart=${escapeRegExp(process.execPath)} ${escapeRegExp(EXPECTED_CLI_PATH)}$`,
        'm',
      ),
    );
    expect(unit).toMatch(new RegExp(`^WorkingDirectory=${escapeRegExp(EXPECTED_PACKAGE_DIR)}$`, 'm'));
    expect(unit).toMatch(/^Environment=PATH=\/usr\/bin:\/bin$/m);
    expect(unit).toMatch(/^KillMode=process$/m);
    expect(unit).toMatch(/^Restart=always$/m);
  });

  it('systemctl daemon-reload → enable → restart → loginctl enable-linger の順で呼ぶ', () => {
    execSyncMock.mockReturnValue(Buffer.from(''));

    setupLinux();

    const calls = execSyncMock.mock.calls.map((c) => c[0]);
    // 順序が崩れると tmux がリロードを取りこぼしたり起動失敗を握り潰したりするため、
    // 完全な順序付き比較で固定する。loginctl は USER が空でないときだけ呼ばれる。
    expect(calls).toEqual([
      'systemctl --user daemon-reload',
      'systemctl --user enable zenterm-gateway',
      'systemctl --user restart zenterm-gateway',
      'loginctl enable-linger testuser',
    ]);
  });

  it('USER が空のときは loginctl enable-linger を呼ばない', () => {
    process.env.USER = '';
    execSyncMock.mockReturnValue(Buffer.from(''));

    setupLinux();

    const calls = execSyncMock.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => typeof c === 'string' && c.startsWith('loginctl'))).toBe(false);
  });

  it('systemctl が失敗したらエラーを握り潰し、daemon-reload 1 回だけで return する', () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('systemctl missing');
    });

    expect(() => setupLinux()).not.toThrow();
    // unit の書き込みは systemctl 呼び出し前に走る
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    // catch で early return するため、daemon-reload 1 回しか呼ばれない（enable / restart / loginctl は呼ばれない）
    const calls = execSyncMock.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(['systemctl --user daemon-reload']);
  });
});

describe('buildLaunchdPlist', () => {
  const params = {
    nodePath: '/usr/local/bin/node',
    cliPath: '/Users/me/.npm-global/lib/node_modules/zenterm-gateway/dist/cli.js',
    packageDir: '/Users/me/.npm-global/lib/node_modules/zenterm-gateway',
    user: 'me',
    homeDir: '/Users/me',
    pathEnv: '/usr/local/bin:/usr/bin:/bin',
    logPath: '/Users/me/Library/Logs/zenterm-gateway.log',
  } as const;

  it('ProgramArguments に nodePath と cliPath を順に含む', () => {
    const plist = buildLaunchdPlist(params);
    expect(plist).toContain(`<string>${params.nodePath}</string>\n\t\t<string>${params.cliPath}</string>`);
  });

  it('EnvironmentVariables に HOME と PATH を埋め込む', () => {
    const plist = buildLaunchdPlist(params);
    expect(plist).toContain(`<key>HOME</key>\n\t\t<string>${params.homeDir}</string>`);
    expect(plist).toContain(`<key>PATH</key>\n\t\t<string>${params.pathEnv}</string>`);
  });

  it('UserName / WorkingDirectory / StandardOutPath / StandardErrorPath が指定値で埋まる', () => {
    const plist = buildLaunchdPlist(params);
    expect(plist).toContain(`<key>UserName</key>\n\t<string>${params.user}</string>`);
    expect(plist).toContain(`<key>WorkingDirectory</key>\n\t<string>${params.packageDir}</string>`);
    expect(plist).toContain(`<key>StandardOutPath</key>\n\t<string>${params.logPath}</string>`);
    expect(plist).toContain(`<key>StandardErrorPath</key>\n\t<string>${params.logPath}</string>`);
  });

  it('KeepAlive と RunAtLoad が true', () => {
    const plist = buildLaunchdPlist(params);
    expect(plist).toMatch(/<key>KeepAlive<\/key>\s*<true\/>/);
    expect(plist).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/);
  });
});

describe('setupMacOS', () => {
  const originalHome = process.env.HOME;
  const originalUser = process.env.USER;
  const originalPath = process.env.PATH;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = '/Users/testuser';
    process.env.USER = 'testuser';
    process.env.PATH = '/usr/local/bin:/usr/bin:/bin';
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USER = originalUser;
    process.env.PATH = originalPath;
  });

  it('plist を ~/Library/LaunchAgents に書き込み、CLI パス / WorkingDirectory / PATH / HOME / USER / log がすべて期待値で埋まる', () => {
    setupMacOS();

    expect(mkdirSyncMock).toHaveBeenCalledWith('/Users/testuser/Library/LaunchAgents', {
      recursive: true,
    });

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [writePath, writeContent] = writeFileSyncMock.mock.calls[0];
    expect(writePath).toBe('/Users/testuser/Library/LaunchAgents/com.zenterm.gateway.plist');

    const plist = writeContent as string;
    // ProgramArguments: 先頭が node、2 つめが setup.ts 由来の cli.js
    expect(plist).toContain(
      `<string>${process.execPath}</string>\n\t\t<string>${EXPECTED_CLI_PATH}</string>`,
    );
    // WorkingDirectory: setup.ts 由来の packageDir
    expect(plist).toContain(`<key>WorkingDirectory</key>\n\t<string>${EXPECTED_PACKAGE_DIR}</string>`);
    // EnvironmentVariables: PATH と HOME
    expect(plist).toContain('<key>HOME</key>\n\t\t<string>/Users/testuser</string>');
    expect(plist).toContain('<key>PATH</key>\n\t\t<string>/usr/local/bin:/usr/bin:/bin</string>');
    // UserName / ログ
    expect(plist).toContain('<key>UserName</key>\n\t<string>testuser</string>');
    expect(plist).toContain(
      '<key>StandardOutPath</key>\n\t<string>/Users/testuser/Library/Logs/zenterm-gateway.log</string>',
    );
    expect(plist).toContain(
      '<key>StandardErrorPath</key>\n\t<string>/Users/testuser/Library/Logs/zenterm-gateway.log</string>',
    );
  });

  it('launchctl unload (失敗無視) → writeFileSync → launchctl load の順で呼ぶ', () => {
    execSyncMock.mockImplementation((cmd) => {
      if (typeof cmd === 'string' && cmd.startsWith('launchctl unload')) {
        // unload は未ロード時に失敗するのが正常 — 握り潰される想定
        throw new Error('not loaded');
      }
      return Buffer.from('');
    });

    setupMacOS();

    // 旧 plist を unload → 新 plist を書き込み → load の順序が崩れると、
    // 古い ExecStart で再ロードする等の壊れた挙動になる。グローバルな invocation order で固定する。
    const unloadCall = execSyncMock.mock.calls.findIndex(
      (c) => typeof c[0] === 'string' && (c[0] as string).startsWith('launchctl unload'),
    );
    const loadCall = execSyncMock.mock.calls.findIndex(
      (c) => typeof c[0] === 'string' && (c[0] as string).startsWith('launchctl load'),
    );
    expect(unloadCall).toBeGreaterThanOrEqual(0);
    expect(loadCall).toBeGreaterThanOrEqual(0);

    const unloadOrder = execSyncMock.mock.invocationCallOrder[unloadCall];
    const loadOrder = execSyncMock.mock.invocationCallOrder[loadCall];
    const writeOrder = writeFileSyncMock.mock.invocationCallOrder[0];

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    expect(unloadOrder).toBeLessThan(writeOrder);
    expect(writeOrder).toBeLessThan(loadOrder);
  });
});

describe('deploy/zenterm-gateway.service テンプレート', () => {
  // install.sh は packages/gateway 配下のコードを通らず deploy/ 直下のテンプレートを
  // sed | sudo tee で配置するため、buildSystemdUnit() のテストとは別に静的検証する。
  it('[Service] セクションに KillMode=process を含む', async () => {
    const templatePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      '..',
      'deploy',
      'zenterm-gateway.service',
    );

    // vi.mock('node:fs') の影響を受けないよう vi.importActual で生 fs を取得して読む。
    const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const content = actualFs.readFileSync(templatePath, 'utf8');
    const serviceSection = content.split(/\n(?=\[)/).find((s) => s.startsWith('[Service]')) ?? '';
    expect(serviceSection).toMatch(/^KillMode=process$/m);
  });
});
