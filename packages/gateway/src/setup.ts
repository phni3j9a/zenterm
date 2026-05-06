import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getHome(): string {
  return process.env.HOME ?? '';
}

export async function runSetup(): Promise<void> {
  const platform = process.platform;
  const configDir = join(getHome(), '.config', 'zenterm');
  const envPath = join(configDir, '.env');

  console.log('');
  console.log('zenterm-gateway 常時起動セットアップ');
  console.log('====================================');
  console.log('');

  if (!existsSync(envPath)) {
    console.log('.env が見つかりません。');
    console.log('先に npx -y zenterm-gateway@latest を実行して初回セットアップを完了してください。');
    process.exit(1);
  }

  const osLabel = platform === 'darwin' ? 'macOS (launchd)' : 'Linux (systemd)';
  console.log(`OS:   ${osLabel}`);
  console.log(`Node: ${process.execPath}`);
  console.log('');

  if (platform === 'darwin') {
    setupMacOS();
  } else if (platform === 'linux') {
    setupLinux();
  } else {
    console.error(`未対応のプラットフォーム: ${platform}`);
    console.error('macOS または Linux でのみ実行できます。');
    process.exit(1);
  }

  console.log('');
  console.log('セットアップが完了しました。');
  console.log('マシンの再起動後も自動的に zenterm-gateway が起動します。');
}

interface SystemdUnitParams {
  nodePath: string;
  cliPath: string;
  packageDir: string;
  pathEnv: string;
}

export function buildSystemdUnit(params: SystemdUnitParams): string {
  return [
    '[Unit]',
    'Description=ZenTerm Gateway - Terminal WebSocket Server',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${params.packageDir}`,
    `ExecStart=${params.nodePath} ${params.cliPath}`,
    'Restart=always',
    'RestartSec=5',
    // tmux サーバーは Gateway と同じ cgroup に属するが、自己デーモン化しているので
    // KillMode=process なら停止・再起動時に Gateway 本体だけが SIGTERM を受け、
    // 既存 tmux セッションは保持される。
    'KillMode=process',
    `Environment=PATH=${params.pathEnv}`,
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

export function setupLinux(): void {
  const nodePath = process.execPath;
  const cliPath = join(__dirname, 'cli.js');
  const packageDir = join(__dirname, '..');
  const currentPath = process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin';

  const serviceDir = join(getHome(), '.config', 'systemd', 'user');
  const servicePath = join(serviceDir, 'zenterm-gateway.service');

  const service = buildSystemdUnit({
    nodePath,
    cliPath,
    packageDir,
    pathEnv: currentPath,
  });

  mkdirSync(serviceDir, { recursive: true });
  writeFileSync(servicePath, service, 'utf8');
  console.log(`作成: ${servicePath}`);

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
    execSync('systemctl --user enable zenterm-gateway', { stdio: 'pipe' });
    execSync('systemctl --user restart zenterm-gateway', { stdio: 'pipe' });
  } catch {
    console.error('systemctl コマンドの実行に失敗しました。');
    console.error('手動で以下を実行してください:');
    console.error('  systemctl --user daemon-reload');
    console.error('  systemctl --user enable --now zenterm-gateway');
    return;
  }

  // Enable lingering so service starts at boot without login session
  const user = process.env.USER ?? '';
  if (user) {
    try {
      execSync(`loginctl enable-linger ${user}`, { stdio: 'pipe' });
    } catch {
      console.log('');
      console.log(`注意: ブート時の自動起動には管理者が以下を実行してください:`);
      console.log(`  sudo loginctl enable-linger ${user}`);
    }
  }

  console.log('');
  console.log('systemd ユーザーサービスを有効化・起動しました。');
  console.log('');
  console.log('ステータス確認:  systemctl --user status zenterm-gateway');
  console.log('ログ確認:        journalctl --user -u zenterm-gateway -f');
  console.log('再起動:          systemctl --user restart zenterm-gateway');
  console.log('停止・無効化:    systemctl --user disable --now zenterm-gateway');
}

interface LaunchdPlistParams {
  nodePath: string;
  cliPath: string;
  packageDir: string;
  user: string;
  homeDir: string;
  pathEnv: string;
  logPath: string;
}

export function buildLaunchdPlist(params: LaunchdPlistParams): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>Label</key>
\t<string>com.zenterm.gateway</string>

\t<key>ProgramArguments</key>
\t<array>
\t\t<string>${params.nodePath}</string>
\t\t<string>${params.cliPath}</string>
\t</array>

\t<key>WorkingDirectory</key>
\t<string>${params.packageDir}</string>

\t<key>EnvironmentVariables</key>
\t<dict>
\t\t<key>HOME</key>
\t\t<string>${params.homeDir}</string>
\t\t<key>PATH</key>
\t\t<string>${params.pathEnv}</string>
\t</dict>

\t<key>UserName</key>
\t<string>${params.user}</string>

\t<key>KeepAlive</key>
\t<true/>

\t<key>RunAtLoad</key>
\t<true/>

\t<key>StandardOutPath</key>
\t<string>${params.logPath}</string>

\t<key>StandardErrorPath</key>
\t<string>${params.logPath}</string>

\t<key>ThrottleInterval</key>
\t<integer>5</integer>
</dict>
</plist>
`;
}

export function setupMacOS(): void {
  const nodePath = process.execPath;
  const cliPath = join(__dirname, 'cli.js');
  const packageDir = join(__dirname, '..');
  const user = process.env.USER ?? '';
  const currentPath = process.env.PATH ?? '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin';
  const homeDir = getHome();
  const logPath = join(homeDir, 'Library', 'Logs', 'zenterm-gateway.log');

  const plistDir = join(homeDir, 'Library', 'LaunchAgents');
  const plistPath = join(plistDir, 'com.zenterm.gateway.plist');

  const plist = buildLaunchdPlist({
    nodePath,
    cliPath,
    packageDir,
    user,
    homeDir,
    pathEnv: currentPath,
    logPath,
  });

  mkdirSync(plistDir, { recursive: true });

  // Unload existing service if present
  try {
    execSync(`launchctl unload "${plistPath}"`, { stdio: 'pipe' });
  } catch {
    // Not loaded yet — ignore
  }

  writeFileSync(plistPath, plist, 'utf8');
  console.log(`作成: ${plistPath}`);

  try {
    execSync(`launchctl load "${plistPath}"`, { stdio: 'pipe' });
  } catch {
    console.error('launchd へのロードに失敗しました。');
    console.error(`手動で実行: launchctl load "${plistPath}"`);
    return;
  }

  console.log('');
  console.log('launchd にサービスを登録・起動しました。');
  console.log('');
  console.log('ステータス確認:  launchctl list | grep zenterm');
  console.log(`ログ確認:        tail -f ${logPath}`);
  console.log(`停止:            launchctl unload "${plistPath}"`);
}
