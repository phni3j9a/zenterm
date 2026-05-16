# Gateway 配布経路 GitHub Releases 移行 (Phase 0 + Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Releases 経由で Gateway をインストールできるインフラ (release workflow + install-from-release.sh + setup.ts 拡張) を整備し、自分の Mac mini の systemd unit を `~/.local/share/zenterm-gateway/current/` symlink ベースの稼働に切り替える。

**Architecture:** `setup.ts` の既存ロジックを optional な `cliPath` / `packageDir` 引数で拡張し、install-from-release.sh から呼び出せるようにする。tarball は CI で build → release asset として up。install.sh が tarball + checksums をダウンロード・SHA256 verify・`~/.local/share/zenterm-gateway/<version>/` に展開し、最後に node 経由で `setup` サブコマンドを叩いて systemd / launchd を登録する。

**Tech Stack:** TypeScript (gateway), bash (install.sh), GitHub Actions, vitest, Docker (E2E リハーサル)

**Scope:** spec `docs/superpowers/specs/2026-05-16-gateway-github-releases-migration-design.md` の Phase 0 + Phase 1 のみ。Phase 2 (npm deprecate) / Phase 3 (unpublish 申請) は運用作業のため別 plan で扱う。

---

## File Structure

新規作成 / 修正するファイル:

- 新規: `.github/workflows/release.yml` — `v*` tag push と `workflow_dispatch` で発火、build → tarball → checksums → attestation → release upload
- 新規: `deploy/install-from-release.sh` — GitHub Release から取得して `~/.local/share/zenterm-gateway/<version>/` に展開、`setup` 呼出
- 新規: `scripts/test-install-from-release.sh` — Docker container 内で install-from-release.sh を E2E でリハーサル
- 修正: `packages/gateway/src/setup.ts` — `setupLinux` / `setupMacOS` に optional `cliPath` / `packageDir` を追加 (40-50 行の差分)
- 修正: `packages/gateway/src/__tests__/setup.test.ts` — 新しい引数経路のテスト追加
- 修正: `packages/gateway/src/cli.ts` — `setup --install-dir <path>` フラグを追加
- 修正: `README.md` — install セクションを差し替え (GitHub Releases を Recommended、git clone を Developers セクションへ)
- 修正: `server/CLAUDE.md` (= `CLAUDE.md`) — "systemd" / "配信アーキテクチャ" セクションを更新
- 据置: `deploy/install.sh`, `deploy/zenterm-gateway.service`, `deploy/com.zenterm.gateway.plist` — リポジトリクローン経路の開発者向けとして残す

---

## Task 1: Phase 0 — 自分の systemd unit を `@0.6.1` 明示固定で再 setup

**Files:**
- 読み取りのみ: `~/.config/systemd/user/zenterm-gateway.service`
- 一時生成: `~/.config/systemd/user/zenterm-gateway.service.bak`

実態調査の結果、ExecStart は既に npx キャッシュ内の固定 path を直接指しているため `@latest` 自動追従は起きていない。ただし、`npm cache clean` や `npx -y zenterm-gateway@latest setup` 再実行のタイミングで悪意ある版を引く間接的経路は残るため、明示的に `@0.6.1` を固定 setup し直して状態をリセットしておく。

- [ ] **Step 1: 現状の unit ファイルをバックアップ**

```bash
cp ~/.config/systemd/user/zenterm-gateway.service \
   ~/.config/systemd/user/zenterm-gateway.service.bak
```

確認: `ls -la ~/.config/systemd/user/zenterm-gateway.service*` で `.bak` が存在すること。

- [ ] **Step 2: 現 ExecStart が指している cli.js の中身バージョンを確認**

```bash
NPX_CLI=$(grep -oE 'ExecStart=\S+ \S+' ~/.config/systemd/user/zenterm-gateway.service | awk '{print $2}')
node -e "const p=require('$NPX_CLI/../../package.json'); console.log(p.version)"
```

期待: `0.6.1` と表示される（あるいは過去版が焼かれている場合は別の値）。値を控えておく。

- [ ] **Step 3: `npx -y zenterm-gateway@0.6.1 setup` を実行して unit を明示再生成**

```bash
npx -y zenterm-gateway@0.6.1 setup
```

期待: 「systemd ユーザーサービスを有効化・起動しました。」が表示され、`~/.config/systemd/user/zenterm-gateway.service` が新しい timestamp で書き換わる。

- [ ] **Step 4: 新 unit の ExecStart に `0.6.1` の path が含まれることを確認**

```bash
grep ExecStart ~/.config/systemd/user/zenterm-gateway.service
```

期待: `0.6.1` を含む npx キャッシュパス (`/home/server/.npm/_npx/<hash>/node_modules/zenterm-gateway/...`) 。

- [ ] **Step 5: service の稼働を確認**

```bash
systemctl --user status zenterm-gateway --no-pager | head -20
```

期待: `active (running)`、再起動から数秒以内のプロセス。

- [ ] **Step 6: iPhone アプリから接続して動作確認**

接続できること、tmux セッションが従前どおり生きていることを目視確認。

- [ ] **Step 7: バックアップ削除（任意）**

問題なければ `.bak` を削除する。問題があれば `.bak` を戻して `systemctl --user daemon-reload && systemctl --user restart zenterm-gateway`。

```bash
rm ~/.config/systemd/user/zenterm-gateway.service.bak
```

このタスクはコード変更を伴わない運用作業のため、git commit は不要。

---

## Task 2: `setupLinux` / `setupMacOS` に optional な `cliPath` / `packageDir` 引数を追加

**Files:**
- Modify: `packages/gateway/src/setup.ts:79-130` (`setupLinux`), `packages/gateway/src/setup.ts:189-237` (`setupMacOS`)
- Test: `packages/gateway/src/__tests__/setup.test.ts`

`buildSystemdUnit()` と `buildLaunchdPlist()` は既に `cliPath` / `packageDir` を引数で受け取る形になっているため変更不要。改修対象は `setupLinux()` / `setupMacOS()` の path 解決ロジック (`__dirname` ベース → optional 引数を優先) のみ。

### Step 2.1: setupLinux の失敗するテストを追加

- [ ] **テストを追加**

`packages/gateway/src/__tests__/setup.test.ts` の `describe('setupLinux', ...)` の末尾 (現 144 行目以降) に以下を追加:

```typescript
  it('cliPath / packageDir を渡したらそれを ExecStart / WorkingDirectory に焼き込む', () => {
    setupLinux({
      cliPath: '/home/testuser/.local/share/zenterm-gateway/current/dist/cli.js',
      packageDir: '/home/testuser/.local/share/zenterm-gateway/current',
    });

    const [, writeContent] = writeFileSyncMock.mock.calls[0];
    const unit = writeContent as string;
    expect(unit).toContain(
      'ExecStart=' + process.execPath +
        ' /home/testuser/.local/share/zenterm-gateway/current/dist/cli.js',
    );
    expect(unit).toContain(
      'WorkingDirectory=/home/testuser/.local/share/zenterm-gateway/current',
    );
  });
```

- [ ] **テストを実行して失敗を確認**

```bash
cd packages/gateway && npx vitest run src/__tests__/setup.test.ts -t "cliPath / packageDir"
```

期待: FAIL — `setupLinux` が引数を受け取らないため `TypeError` または ExecStart に期待の path が含まれない。

### Step 2.2: setupLinux に optional 引数を追加

- [ ] **`packages/gateway/src/setup.ts:79` の signature を変更**

```typescript
interface SetupOverrides {
  cliPath?: string;
  packageDir?: string;
}

export function setupLinux(overrides: SetupOverrides = {}): void {
  const nodePath = process.execPath;
  const cliPath = overrides.cliPath ?? join(__dirname, 'cli.js');
  const packageDir = overrides.packageDir ?? join(__dirname, '..');
  const currentPath = process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin';
  // ...以下は既存のまま (serviceDir / servicePath 以降)
```

- [ ] **テストを再実行して通ることを確認**

```bash
cd packages/gateway && npx vitest run src/__tests__/setup.test.ts -t "cliPath / packageDir"
```

期待: PASS。既存テストもすべて通ること:

```bash
cd packages/gateway && npx vitest run src/__tests__/setup.test.ts
```

### Step 2.3: setupMacOS にも同じ拡張を追加 (テスト先行)

- [ ] **setupMacOS のテストを追加**

`describe('setupMacOS', ...)` の末尾に以下を追加:

```typescript
  it('cliPath / packageDir を渡したら plist の ProgramArguments / WorkingDirectory に焼き込む', () => {
    setupMacOS({
      cliPath: '/Users/testuser/.local/share/zenterm-gateway/current/dist/cli.js',
      packageDir: '/Users/testuser/.local/share/zenterm-gateway/current',
    });

    const [, writeContent] = writeFileSyncMock.mock.calls[0];
    const plist = writeContent as string;
    expect(plist).toContain(
      '<string>' + process.execPath + '</string>\n\t\t' +
        '<string>/Users/testuser/.local/share/zenterm-gateway/current/dist/cli.js</string>',
    );
    expect(plist).toContain(
      '<key>WorkingDirectory</key>\n\t<string>/Users/testuser/.local/share/zenterm-gateway/current</string>',
    );
  });
```

- [ ] **テストを実行して失敗を確認**

```bash
cd packages/gateway && npx vitest run src/__tests__/setup.test.ts -t "cliPath / packageDir を渡したら plist"
```

期待: FAIL — `setupMacOS` が引数を受け取らないため。

- [ ] **`packages/gateway/src/setup.ts:189` の signature を変更**

```typescript
export function setupMacOS(overrides: SetupOverrides = {}): void {
  const nodePath = process.execPath;
  const cliPath = overrides.cliPath ?? join(__dirname, 'cli.js');
  const packageDir = overrides.packageDir ?? join(__dirname, '..');
  // ...以下は既存のまま
```

- [ ] **テストを再実行して通ることを確認**

```bash
cd packages/gateway && npx vitest run src/__tests__/setup.test.ts
```

期待: 全テスト PASS。

### Step 2.4: commit

- [ ] **commit**

```bash
git add packages/gateway/src/setup.ts packages/gateway/src/__tests__/setup.test.ts
git commit -m "$(cat <<'EOF'
feat(gateway/setup): setupLinux/setupMacOS に cliPath/packageDir override を追加

GitHub Releases 経由インストールで current symlink を ExecStart に焼く必要があるため、
外部から path を注入できるよう optional 引数を追加。既存の __dirname フォールバックは
維持するので npx 経由の setup には影響なし。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `cli.ts` の `setup` サブコマンドに `--install-dir` フラグを追加

**Files:**
- Modify: `packages/gateway/src/cli.ts:61-66` (`setup` 分岐)

`runSetup()` 自体は引数を取らない現状の API (`packages/gateway/src/setup.ts:12`) なので、まず `runSetup` 側に optional 引数を追加し、CLI 側がパースした install-dir を受け渡せるようにする。

### Step 3.1: runSetup に install-dir を受け取れるよう拡張

- [ ] **`packages/gateway/src/setup.ts:12` を変更**

```typescript
export async function runSetup(installDir?: string): Promise<void> {
  const platform = process.platform;
  const configDir = join(getHome(), '.config', 'zenterm');
  const envPath = join(configDir, '.env');

  // ...既存の console.log + envPath チェックはそのまま...

  const overrides: SetupOverrides = installDir
    ? {
        cliPath: join(installDir, 'dist', 'cli.js'),
        packageDir: installDir,
      }
    : {};

  if (platform === 'darwin') {
    setupMacOS(overrides);
  } else if (platform === 'linux') {
    setupLinux(overrides);
  } else {
    // ...既存のまま...
  }
  // ...以降そのまま...
}
```

### Step 3.2: cli.ts で `--install-dir` をパース

- [ ] **`packages/gateway/src/cli.ts:62` の setup 分岐を変更**

```typescript
// --- setup subcommand ---
if (process.argv[2] === 'setup') {
  const installDir = parseFlag('install-dir');
  const { runSetup } = await import('./setup.js');
  await runSetup(installDir);
  process.exit(0);
}
```

- [ ] **`packages/gateway/src/cli.ts:32-43` の `--help` の Options セクションに `--install-dir` を追記**

```typescript
Options:
  --port <number>       ポート番号 (default: 18765)
  --host <string>       バインドアドレス (default: 0.0.0.0)
  --install-dir <path>  setup 時に systemd/launchd unit が指す絶対パス
                        (GitHub Releases 経由インストール時に install.sh が指定)
  -h, --help            ヘルプを表示
  -v, --version         バージョンを表示
```

### Step 3.3: 手動動作確認とビルド検証

- [ ] **gateway を再ビルド**

```bash
cd packages/gateway && npx tsc
```

期待: エラーなし。

- [ ] **新フラグが認識されることを確認**

```bash
cd packages/gateway && node dist/cli.js --help | grep install-dir
```

期待: `--install-dir <path>` 行が表示される。

- [ ] **既存テストがすべて通ることを確認**

```bash
cd packages/gateway && npx vitest run
```

期待: 全テスト PASS。

### Step 3.4: commit

- [ ] **commit**

```bash
git add packages/gateway/src/cli.ts packages/gateway/src/setup.ts
git commit -m "$(cat <<'EOF'
feat(gateway/cli): setup --install-dir フラグを追加

install-from-release.sh から呼び出すとき、tarball 展開先 (current symlink) を
ExecStart に焼き込めるようにする。フラグなしの呼び出しは従来通り __dirname を使う。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `deploy/install-from-release.sh` の骨格 — download + verify + extract

**Files:**
- Create: `deploy/install-from-release.sh`

このタスクでは tarball 取得・verify・展開までを実装。`.env` セットアップと systemd 登録は Task 5 / 6 で追加する。

### Step 4.1: 失敗するテストを書く (Docker E2E のリハーサルは Task 7 でまとめる。ここではローカルで bash -n と shellcheck で静的検証)

- [ ] **shellcheck がローカルにあるか確認**

```bash
command -v shellcheck && shellcheck --version | head -1 || echo "shellcheck がない場合はスキップ可"
```

- [ ] **`deploy/install-from-release.sh` を新規作成**

```bash
#!/usr/bin/env bash
set -euo pipefail

# zenterm-gateway installer — fetches a release tarball from GitHub and installs
# under ~/.local/share/zenterm-gateway/<version>/. Phase 1 minimal version:
# only handles download/verify/extract; .env setup and service registration
# are added in later tasks.

OWNER="${ZENTERM_OWNER:-phni3j9a}"
REPO="${ZENTERM_REPO:-zenterm}"
VERSION="${ZENTERM_VERSION:-}"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/zenterm-gateway"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --version=*) VERSION="${1#*=}"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# Resolve "latest" via the redirect from /releases/latest/download/...
if [[ -z "$VERSION" ]]; then
  RESOLVED=$(curl -fsSI "https://github.com/${OWNER}/${REPO}/releases/latest/download/checksums.txt" \
    | grep -i '^location:' | sed -E 's@.*/download/(v[^/]+)/.*@\1@' | tr -d '\r\n')
  if [[ -z "$RESOLVED" ]]; then
    echo "Error: failed to resolve latest version" >&2
    exit 1
  fi
  VERSION="$RESOLVED"
fi

VERSION_NO_V="${VERSION#v}"
TARBALL="zenterm-gateway-${VERSION_NO_V}.tar.gz"
BASE_URL="https://github.com/${OWNER}/${REPO}/releases/download/${VERSION}"
INSTALL_DIR="${DATA_DIR}/${VERSION_NO_V}"

echo "==> Installing zenterm-gateway ${VERSION} to ${INSTALL_DIR}"

# 1. environment checks
command -v node >/dev/null || { echo "Error: node not found"; exit 1; }
command -v tmux >/dev/null || { echo "Error: tmux not found"; exit 1; }
command -v tar  >/dev/null || { echo "Error: tar not found"; exit 1; }
NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if (( NODE_MAJOR < 20 )); then
  echo "Error: Node.js >= 20 required (found $(node -v))" >&2
  exit 1
fi

# 2. download tarball + checksums
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "==> Downloading ${TARBALL}"
curl -fsSL "${BASE_URL}/${TARBALL}" -o "${TMP}/${TARBALL}"
curl -fsSL "${BASE_URL}/checksums.txt" -o "${TMP}/checksums.txt"

# 3. verify SHA256
echo "==> Verifying SHA256"
( cd "$TMP" && grep " ${TARBALL}\$" checksums.txt | sha256sum -c - )

# 4. extract to install dir
mkdir -p "$INSTALL_DIR"
echo "==> Extracting to ${INSTALL_DIR}"
tar -xzf "${TMP}/${TARBALL}" -C "$INSTALL_DIR" --strip-components=1

echo "==> Tarball extracted. (Next steps: npm install, .env setup, service registration)"
echo "    INSTALL_DIR=${INSTALL_DIR}"
```

- [ ] **実行権を付与**

```bash
chmod +x deploy/install-from-release.sh
```

- [ ] **bash 構文チェック**

```bash
bash -n deploy/install-from-release.sh
```

期待: 出力なし (= 構文 OK)。

- [ ] **shellcheck で lint (もしあれば)**

```bash
shellcheck deploy/install-from-release.sh || true
```

期待: warning は確認しつつ、致命的エラーがないこと。

### Step 4.2: commit

- [ ] **commit**

```bash
git add deploy/install-from-release.sh
git commit -m "$(cat <<'EOF'
feat(deploy): install-from-release.sh の骨格を追加 (download + verify + extract)

GitHub Releases から tarball を取得して ~/.local/share/zenterm-gateway/<version>/ に
展開するスクリプト。npm install / .env セットアップ / service 登録は後続タスクで追加。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `install-from-release.sh` に npm install と対話的 `.env` セットアップを追加

**Files:**
- Modify: `deploy/install-from-release.sh`

### Step 5.1: npm install を追加

- [ ] **`deploy/install-from-release.sh` の末尾近く (`==> Tarball extracted` の前) に追記**

```bash
# 5. install runtime dependencies
echo "==> Installing dependencies (npm install --omit=dev)"
( cd "$INSTALL_DIR" && npm install --omit=dev --ignore-scripts=false )
```

- [ ] **`==> Tarball extracted` のメッセージを次のように更新**

```bash
echo "==> Dependencies installed."
echo "    INSTALL_DIR=${INSTALL_DIR}"
```

### Step 5.2: 対話的 `.env` セットアップを追加

- [ ] **同じスクリプトの末尾に追記**

```bash
# 6. interactive .env setup (or accept AUTH_TOKEN env var)
ENV_DIR="${HOME}/.config/zenterm"
ENV_FILE="${ENV_DIR}/.env"
mkdir -p "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  TOKEN="${AUTH_TOKEN:-}"
  if [[ -z "$TOKEN" ]]; then
    if [[ ! -t 0 ]] && [[ ! -r /dev/tty ]]; then
      echo "Error: no tty available and AUTH_TOKEN env var not set" >&2
      echo "  Re-run with: AUTH_TOKEN=1234 ${0}" >&2
      exit 1
    fi
    echo ""
    echo "zenterm-gateway 初回セットアップ"
    echo "================================"
    while true; do
      read -r -p "認証トークン（数字4桁）を入力してください: " TOKEN < /dev/tty
      if [[ "$TOKEN" =~ ^[0-9]{4}$ ]]; then
        break
      fi
      echo "  → 数字4桁で入力してください（例: 1234）"
    done
  fi

  cat > "$ENV_FILE" <<EOF
AUTH_TOKEN=${TOKEN}
PORT=18765
HOST=0.0.0.0
SESSION_PREFIX=zen_
LOG_LEVEL=info
EOF
  echo "==> Generated ${ENV_FILE} (AUTH_TOKEN: ${TOKEN})"
else
  echo "==> Using existing ${ENV_FILE}"
fi
```

### Step 5.3: 動作確認 (テストは Task 7 でまとめて Docker)

- [ ] **bash 構文チェック**

```bash
bash -n deploy/install-from-release.sh
```

期待: 出力なし。

### Step 5.4: commit

- [ ] **commit**

```bash
git add deploy/install-from-release.sh
git commit -m "$(cat <<'EOF'
feat(deploy): install-from-release.sh に npm install と .env セットアップを追加

curl | bash 経由でも /dev/tty から AUTH_TOKEN を対話入力できる。tty が無い CI 環境では
AUTH_TOKEN 環境変数で非対話モードを許可する。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `install-from-release.sh` に `current` symlink 切替と service 登録を追加

**Files:**
- Modify: `deploy/install-from-release.sh`

### Step 6.1: current symlink の切替を追加

- [ ] **`deploy/install-from-release.sh` の末尾に追記**

```bash
# 7. update current symlink atomically
CURRENT="${DATA_DIR}/current"
TMP_LINK="${CURRENT}.new"
ln -sfn "$INSTALL_DIR" "$TMP_LINK"
mv -Tf "$TMP_LINK" "$CURRENT"
echo "==> Updated symlink ${CURRENT} -> ${INSTALL_DIR}"
```

注: `ln -sfn` + `mv -T` の組合せで atomicity を確保（同じ名前の dir を踏まないように `-T` で treat-as-file）。Linux GNU coreutils 前提。macOS の `mv` は `-T` を持たないため、後段の条件分岐で吸収する:

```bash
if [[ "$(uname -s)" == "Darwin" ]]; then
  rm -f "$CURRENT"
  ln -s "$INSTALL_DIR" "$CURRENT"
else
  ln -sfn "$INSTALL_DIR" "$TMP_LINK"
  mv -Tf "$TMP_LINK" "$CURRENT"
fi
```

上のスニペットで `ln -sfn ... && mv -Tf ...` を置き換えること。

### Step 6.2: service 登録を追加

- [ ] **同じスクリプトの末尾に追記**

```bash
# 8. register systemd / launchd service
echo "==> Registering service"
node "${CURRENT}/dist/cli.js" setup --install-dir "$CURRENT"

echo ""
echo "==> Installation complete."
echo "    Run: node ${CURRENT}/dist/cli.js info"
```

注: setup 後の `info` 表示は setup.ts 側が既に出してくれるはずだが、念のため案内を再掲する。

### Step 6.3: 動作確認

- [ ] **bash 構文チェック**

```bash
bash -n deploy/install-from-release.sh
```

期待: 出力なし。

### Step 6.4: commit

- [ ] **commit**

```bash
git add deploy/install-from-release.sh
git commit -m "$(cat <<'EOF'
feat(deploy): install-from-release.sh で current symlink と service 登録まで完結

Linux は ln -sfn + mv -Tf でアトミック切替、macOS は rm + ln で代替。最後に
node ${CURRENT}/dist/cli.js setup --install-dir ${CURRENT} を叩いて systemd /
launchd unit を生成する。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Docker container 内で install-from-release.sh の E2E リハーサル

**Files:**
- Create: `scripts/test-install-from-release.sh`
- Reference: 既存の `scripts/e2e-docker.sh` の Docker パターン

このタスクでは、ローカル開発時に release が無くても install-from-release.sh を検証できるよう、tarball を `npm pack` 相当で手元で作り、HTTP サーバーで配信し、それを install スクリプトに食わせるリハーサルテストを書く。

### Step 7.1: ヘルパースクリプトを作成

- [ ] **`scripts/test-install-from-release.sh` を新規作成**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Local rehearsal for deploy/install-from-release.sh.
# Builds a tarball from the working copy, serves it on localhost,
# and runs install-from-release.sh inside a Docker container against it.
#
# Usage:
#   scripts/test-install-from-release.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="0.0.0-test"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; pkill -P $$ || true' EXIT

# 1. build
echo "==> Building gateway"
( cd packages/gateway && npx tsc )
echo "==> Building web"
( cd packages/web && npx vite build )

# 2. pack tarball
echo "==> Packing tarball"
TARBALL="$TMP/zenterm-gateway-${VERSION}.tar.gz"
tar -czf "$TARBALL" \
  -C packages/gateway \
  --transform "s,^,zenterm-gateway-${VERSION}/," \
  dist public package.json package-lock.json

# 3. checksums
( cd "$TMP" && sha256sum "zenterm-gateway-${VERSION}.tar.gz" > checksums.txt )

# 4. serve via python http.server in background
PORT=18099
( cd "$TMP" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
HTTP_PID=$!
sleep 1

# 5. run install-from-release.sh inside docker against a mocked endpoint
#    We override BASE_URL by patching the script via a env var indirection;
#    simplest is to set ZENTERM_OWNER/REPO to point at our local stub.
echo "==> Running install-from-release.sh inside docker"
docker run --rm \
  --network host \
  -v "$ROOT/deploy/install-from-release.sh:/install.sh:ro" \
  -v "$TMP:/stub:ro" \
  -e AUTH_TOKEN=1234 \
  -e HOME=/tmp/home \
  node:20-bookworm bash -c '
    apt-get update -qq && apt-get install -y -qq tmux curl >/dev/null
    mkdir -p /tmp/home
    # The script downloads from github.com — we replace the constants by sed
    # for this rehearsal. (Future: parameterize BASE_URL directly.)
    sed -e "s,https://github.com/\${OWNER}/\${REPO}/releases/latest/download/checksums.txt,http://localhost:'"$PORT"'/checksums.txt,g" \
        -e "s,https://github.com/\${OWNER}/\${REPO}/releases/download/\${VERSION},http://localhost:'"$PORT"',g" \
        /install.sh > /tmp/install.sh
    chmod +x /tmp/install.sh
    ZENTERM_VERSION=v'"$VERSION"' bash /tmp/install.sh --version v'"$VERSION"'
    test -f /tmp/home/.local/share/zenterm-gateway/'"$VERSION"'/dist/cli.js
    test -L /tmp/home/.local/share/zenterm-gateway/current
    test -f /tmp/home/.config/zenterm/.env
    echo "==> Rehearsal: all assertions passed"
  '

echo "==> Rehearsal complete"
```

- [ ] **実行権を付与**

```bash
chmod +x scripts/test-install-from-release.sh
```

- [ ] **bash 構文チェック**

```bash
bash -n scripts/test-install-from-release.sh
```

期待: 出力なし。

### Step 7.2: 一度走らせて成功するか確認

- [ ] **リハーサルを実行**

```bash
scripts/test-install-from-release.sh
```

期待: 末尾に `==> Rehearsal: all assertions passed` と `==> Rehearsal complete` が両方表示される。

注: もし sed の URL 置換が install-from-release.sh の `${OWNER}/${REPO}` 展開と噛み合わない場合 (=実 BASH では既に変数展開済の文字列なのでマッチしない)、install-from-release.sh 側に `ZENTERM_BASE_URL` 環境変数による override を追加して、リハーサルではそちらを設定する形に切り替える。具体的には install-from-release.sh の BASE_URL 構築箇所を:

```bash
BASE_URL="${ZENTERM_BASE_URL:-https://github.com/${OWNER}/${REPO}/releases/download/${VERSION}}"
```

に変更し、`latest` 解決ロジックも `ZENTERM_BASE_URL` がセットされていればその親パスからチェックサムを取りに行く形にする。リハーサル側は `ZENTERM_BASE_URL=http://localhost:18099` だけ渡せば良い。リハーサルの sed フィルタは削除する。

### Step 7.3: install-from-release.sh に `ZENTERM_BASE_URL` 対応を追加 (Step 7.2 で必要と判明した場合)

- [ ] **`deploy/install-from-release.sh` の `BASE_URL=` 行を変更**

```bash
BASE_URL="${ZENTERM_BASE_URL:-https://github.com/${OWNER}/${REPO}/releases/download/${VERSION}}"
```

- [ ] **`latest` 解決ロジックも `ZENTERM_BASE_URL` 対応に**

該当箇所を以下に置換:

```bash
if [[ -z "$VERSION" ]]; then
  if [[ -n "${ZENTERM_BASE_URL:-}" ]]; then
    VERSION="v${VERSION_NO_V:-0.0.0}"  # stub 用、テストでは --version 必須にする
    echo "Error: --version required when ZENTERM_BASE_URL is set" >&2
    exit 1
  fi
  RESOLVED=$(curl -fsSI "https://github.com/${OWNER}/${REPO}/releases/latest/download/checksums.txt" \
    | grep -i '^location:' | sed -E 's@.*/download/(v[^/]+)/.*@\1@' | tr -d '\r\n')
  if [[ -z "$RESOLVED" ]]; then
    echo "Error: failed to resolve latest version" >&2
    exit 1
  fi
  VERSION="$RESOLVED"
fi
```

- [ ] **リハーサルを再実行して通ることを確認**

```bash
scripts/test-install-from-release.sh
```

### Step 7.4: commit

- [ ] **commit**

```bash
git add deploy/install-from-release.sh scripts/test-install-from-release.sh
git commit -m "$(cat <<'EOF'
test(deploy): install-from-release.sh の Docker E2E リハーサルを追加

ZENTERM_BASE_URL 環境変数で base URL を override 可能にし、tmpdir で
HTTP server を立てて Docker container 内から install スクリプトを走らせる。
release 不要でローカル検証できる。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `.github/workflows/release.yml` を新規作成

**Files:**
- Create: `.github/workflows/release.yml`

### Step 8.1: workflow ファイルを作成

- [ ] **`.github/workflows/release.yml` を新規作成**

```yaml
name: release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version (without v prefix), e.g. 0.7.0-rc.1'
        required: true
        type: string
      dry_run:
        description: 'If true, build artifacts but do not create a release'
        required: false
        default: 'false'
        type: string

permissions:
  contents: write
  id-token: write
  attestations: write

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Resolve version
        id: ver
        run: |
          if [[ "${GITHUB_EVENT_NAME}" == "push" ]]; then
            V="${GITHUB_REF_NAME#v}"
          else
            V="${{ github.event.inputs.version }}"
          fi
          echo "version=$V" >> "$GITHUB_OUTPUT"
          echo "tag=v$V" >> "$GITHUB_OUTPUT"

      - name: Install dependencies
        run: npm ci

      - name: Build web
        run: npm run build --workspace=@zenterm/web

      - name: Build gateway
        run: npm run build:gateway

      - name: Pack tarball
        run: |
          V="${{ steps.ver.outputs.version }}"
          tar -czf "zenterm-gateway-${V}.tar.gz" \
            -C packages/gateway \
            --transform "s,^,zenterm-gateway-${V}/," \
            dist public package.json package-lock.json

      - name: Generate checksums
        run: |
          V="${{ steps.ver.outputs.version }}"
          sha256sum "zenterm-gateway-${V}.tar.gz" > checksums.txt
          cat checksums.txt

      - uses: actions/attest-build-provenance@v2
        with:
          subject-path: 'zenterm-gateway-*.tar.gz'

      - name: Stage install.sh
        run: cp deploy/install-from-release.sh install.sh

      - name: Create release
        if: github.event_name == 'push' || github.event.inputs.dry_run != 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          V="${{ steps.ver.outputs.version }}"
          gh release create "v${V}" \
            --title "v${V}" \
            --generate-notes \
            "zenterm-gateway-${V}.tar.gz" \
            "checksums.txt" \
            "install.sh"

      - name: Upload artifacts (dry-run)
        if: github.event.inputs.dry_run == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ steps.ver.outputs.version }}
          path: |
            zenterm-gateway-*.tar.gz
            checksums.txt
            install.sh
```

### Step 8.2: YAML 構文チェック

- [ ] **構文チェック**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
```

期待: 出力なし (= valid YAML)。

### Step 8.3: commit

- [ ] **commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci: release.yml で tag push 時に tarball + checksums + provenance を upload

v* tag push で発火する build → tarball → SHA256 → SLSA provenance → gh release create
の一本通し。workflow_dispatch + dry_run=true で artifact だけ生成する検証モードも提供。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: README の install セクションを差し替え

**Files:**
- Modify: `README.md:123-154` (`## Quick Start` → `### One-liner Install` / `### Manual Setup`)

### Step 9.1: install セクションを差し替え

- [ ] **`README.md:123-154` を以下に置換**

```markdown
## Quick Start

### One-liner Install (recommended)

```bash
curl -fsSL https://github.com/phni3j9a/zenterm/releases/latest/download/install.sh | bash
```

スクリプトは以下を自動実行します:

1. tmux / Node.js (>= 20) の確認
2. 最新 release の tarball を `~/.local/share/zenterm-gateway/<version>/` にダウンロード・SHA256 verify・展開
3. `npm install --omit=dev` で依存を解決
4. `AUTH_TOKEN` の対話的生成 (`~/.config/zenterm/.env`)
5. `~/.local/share/zenterm-gateway/current` の symlink を新 version に張替え
6. サービス登録 (Linux: systemd user / macOS: launchd)
7. 接続情報の表示

#### Pin a specific version

```bash
curl -fsSL https://github.com/phni3j9a/zenterm/releases/download/v0.7.0/install.sh \
  | bash -s -- --version v0.7.0
```

#### Verify checksums manually

```bash
curl -fsSLO https://github.com/phni3j9a/zenterm/releases/download/v0.7.0/zenterm-gateway-0.7.0.tar.gz
curl -fsSLO https://github.com/phni3j9a/zenterm/releases/download/v0.7.0/checksums.txt
sha256sum -c checksums.txt
```

### Manual Setup (developers)

リポジトリをクローンして手元でビルドする場合は次のコマンド。

```bash
git clone https://github.com/phni3j9a/zenterm.git
cd zenterm && ./deploy/install.sh
```

`deploy/install.sh` はリポジトリ内のソースを直接ビルドして launchd / systemd に登録します。
```

(末尾に既存の `### Re-displaying connection info` セクションが続く)

### Step 9.2: 差し替え後の確認

- [ ] **markdown レンダリング確認 (任意)**

```bash
grep -A 30 "## Quick Start" README.md | head -50
```

期待: 上記の curl コマンドと Pin a specific version / Verify checksums / Manual Setup セクションが順に表示される。

### Step 9.3: commit

- [ ] **commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): install 手順を GitHub Releases ベースに差し替え

curl | bash の one-liner を Recommended に、git clone + deploy/install.sh は
Developers 向けに格下げ。version pin と SHA256 verify の手順も併記。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `server/CLAUDE.md` (= `CLAUDE.md`) を更新

**Files:**
- Modify: `CLAUDE.md` の "配信アーキテクチャ" セクション (systemd の説明箇所)

### Step 10.1: 該当箇所を更新

- [ ] **`CLAUDE.md` の systemd 説明を編集**

該当箇所を Read で確認したうえで、現行の「systemd は npm 公開版の zenterm-gateway パッケージを npx キャッシュ経由で起動する」という記述を以下に置き換える:

```markdown
- **systemd**: `zenterm-gateway.service` の `ExecStart` は `~/.local/share/zenterm-gateway/current/dist/cli.js` を node で実行する。`current` は `deploy/install-from-release.sh` が GitHub Releases から取得した version (`~/.local/share/zenterm-gateway/<version>/`) を指す symlink。アップデートは新 version 展開 → symlink 張替え → `systemctl --user restart zenterm-gateway` で完結する。ローカル変更を反映するには `./deploy/install.sh` (リポジトリクローン経路) を使う。設定ファイル実体は `~/.config/systemd/user/zenterm-gateway.service`、ユーザースコープで稼働。
```

### Step 10.2: commit

- [ ] **commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude-md): systemd 配信アーキテクチャ説明を current symlink ベースに更新

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: dry-run で release workflow を発火し artifact 検証

**Files:**
- 既存: `.github/workflows/release.yml`

### Step 11.1: workflow を dry_run モードで発火

- [ ] **GitHub Actions UI または `gh` CLI で dispatch**

```bash
gh workflow run release.yml -f version=0.7.0-rc.1 -f dry_run=true
```

期待: workflow が起動し、artifact (`release-0.7.0-rc.1`) が生成される。

- [ ] **artifact を取得して中身を確認**

```bash
gh run download --name release-0.7.0-rc.1 -D /tmp/release-dryrun
ls /tmp/release-dryrun
```

期待:
- `zenterm-gateway-0.7.0-rc.1.tar.gz`
- `checksums.txt`
- `install.sh`

- [ ] **tarball を展開して中身を確認**

```bash
mkdir -p /tmp/release-check
tar -xzf /tmp/release-dryrun/zenterm-gateway-0.7.0-rc.1.tar.gz -C /tmp/release-check
ls /tmp/release-check/zenterm-gateway-0.7.0-rc.1/
```

期待: `dist/`, `public/`, `package.json`, `package-lock.json` の 4 つが存在。

- [ ] **SHA256 verify**

```bash
( cd /tmp/release-dryrun && sha256sum -c checksums.txt )
```

期待: `zenterm-gateway-0.7.0-rc.1.tar.gz: OK`。

このタスクはコード変更を伴わないため commit は不要。問題があれば release.yml に戻って修正し、Task 8 と同じ commit ポリシーで追記 commit する。

---

## Task 12: install-from-release.sh の Mac mini 実機リハーサル (並走インストール)

**Files:** なし (運用作業)

### Step 12.1: 別ディレクトリで並走インストール

- [ ] **dry-run で取得した install.sh と tarball を local に置く**

```bash
mkdir -p ~/zenterm-rehearsal
cp /tmp/release-dryrun/* ~/zenterm-rehearsal/
```

- [ ] **install.sh を local file 経由で実行 (ZENTERM_BASE_URL で local 指定)**

```bash
cd ~/zenterm-rehearsal
python3 -m http.server 18099 &
HTTP_PID=$!
ZENTERM_BASE_URL=http://localhost:18099 \
  AUTH_TOKEN=9999 \
  HOME=/tmp/zenterm-rehearsal-home \
  bash install.sh --version v0.7.0-rc.1
kill $HTTP_PID
```

期待:
- `/tmp/zenterm-rehearsal-home/.local/share/zenterm-gateway/0.7.0-rc.1/` に展開される
- `/tmp/zenterm-rehearsal-home/.local/share/zenterm-gateway/current` symlink が貼られる
- systemd 登録は失敗するが (HOME を fake してるため `systemctl --user` がエラー)、それまでのステップが成功すれば OK

- [ ] **生成された unit のテンプレ確認**

setup.ts の `setupLinux` が `cliPath`/`packageDir` を上書きしているかを目視するため、本実機検証では `--install-dir` を真の `~/.local/share/zenterm-gateway/current` 相当として受け取った unit を `journalctl --user -u zenterm-gateway -n 5` 等で確認する。検証用に HOME を 通常パスに戻して再実行する場合は事前に既存 unit をバックアップ (Task 1 と同じ手順) すること。

このタスクはコード変更を伴わないため commit は不要。問題があれば該当 Task に戻って修正する。

---

## Task 13: 既存 systemd を新方式に切り替え (Mac mini 本番)

**Files:** なし (運用作業)

Task 11 / 12 が完了し、本番リリース (v0.7.0) を出した後で実施する。

### Step 13.1: 本番 release を作成

- [ ] **v0.7.0 tag を push**

```bash
git tag v0.7.0
git push origin v0.7.0
```

期待: `.github/workflows/release.yml` が発火し、`https://github.com/phni3j9a/zenterm/releases/tag/v0.7.0` に asset が並ぶ。

### Step 13.2: 本物の install.sh を Mac mini で実行

- [ ] **既存 systemd unit をバックアップ**

```bash
cp ~/.config/systemd/user/zenterm-gateway.service \
   ~/.config/systemd/user/zenterm-gateway.service.npm-bak
```

- [ ] **install.sh を実機で実行 (既存 .env を使うので AUTH_TOKEN プロンプトは出ない想定)**

```bash
curl -fsSL https://github.com/phni3j9a/zenterm/releases/latest/download/install.sh | bash
```

期待: `~/.local/share/zenterm-gateway/0.7.0/` に展開され、symlink + systemd unit が更新される。

### Step 13.3: 接続確認

- [ ] **iPhone アプリから接続し、tmux セッションが保持されていることを確認**

期待:
- 旧 systemd 由来の tmux サーバーが KillMode=process で保護されたまま生きている
- アプリから既存 `zen_*` セッションに attach できる

### Step 13.4: バックアップ削除 (24 時間問題なければ)

- [ ] **バックアップ削除**

```bash
rm ~/.config/systemd/user/zenterm-gateway.service.npm-bak
```

このタスクはコード変更を伴わないため commit は不要。

---

## Plan の自己レビュー結果

- **Spec coverage**: Phase 0 (Task 1), Phase 1 のコード変更 (Tasks 2-7), CI (Task 8), ドキュメント (Tasks 9-10), 検証 (Tasks 11-12), 本番切替 (Task 13) をすべて含む。Phase 2 / Phase 3 はスコープ外として冒頭で宣言済み。
- **Placeholder scan**: TODO / TBD は無し。Task 7 のリハーサルで `sed` 経路と `ZENTERM_BASE_URL` 経路の二択がある点は明示的に Step 7.2 / 7.3 で枝分かれを書き、後者を採るための差分も提示している。
- **Type consistency**: `SetupOverrides` interface, `cliPath` / `packageDir` / `installDir` の命名は Task 2 / Task 3 で一貫している。bash 側は `INSTALL_DIR` / `DATA_DIR` / `CURRENT` で一貫。
- **Ambiguity**: Task 7 のテスト戦略が「sed 置換」と「環境変数 override」の 2 案あるが、後者を採用するための具体的差分を Step 7.3 に書いてある。Task 12 の実機検証で `systemctl --user` が fake HOME で失敗する件は注釈済み。
