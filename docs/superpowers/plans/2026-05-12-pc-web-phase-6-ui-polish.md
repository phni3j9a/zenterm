# ZenTerm PC Web Phase 6 (UI/UX 完成度) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC Web 版の UI/UX 完成度をアプリ版 (iOS) と並ぶ水準まで引き上げる。新規プリミティブ + アイコン基盤 + 全画面リファイン + オンボーディング + マイクロインタラクションを 13 タスクで実装。

**Architecture:** ボトムアップ。基盤プリミティブ (tokens / Card / EmptyState / lucide icons) を整備した上で、構造変更 (LeftRail) → 画面別リファイン (Login/Sessions/Files/Terminal/Settings) → 横断統一 (EmptyState / Onboarding / transition / focus) の順。

**Tech Stack:** React 19 / TypeScript / Vitest / Playwright / lucide-react (新規依存) / @axe-core/playwright (既存)

**Spec:** `docs/superpowers/specs/2026-05-12-pc-web-phase-6-ui-polish.md`

**Prereq:** Phase 5b が main にマージ済 (`web-pc-phase-5b-done`)、ブランチ `feature/web-pc-phase-6-ui-polish` を main から切ってある

---

## 既存コードの把握 (実装前に必読)

### Phase 6 で触るファイル (modify)

- `packages/web/src/theme/tokens.ts` (102 行) — shadows / surfaceSunken / overlay / focusRing 追加
- `packages/web/src/theme/index.ts` — トークン export 拡張
- `packages/web/src/components/AuthenticatedShell.tsx` (453 行) — LeftRail 化、フッタタブ廃止
- `packages/web/src/components/LoginForm.tsx` (106 行) — OTP マス UI に変更
- `packages/web/src/components/SessionsListPanel.tsx` (191 行) — Card 行 + heading + empty 統一
- `packages/web/src/components/sidebar/SessionRow.tsx` — タイムスタンプ + 状態ドット意味付け
- `packages/web/src/components/sidebar/NewSessionButton.tsx` — pill 化
- `packages/web/src/components/files/FilesToolbar.tsx` — IconButton + tooltip 化
- `packages/web/src/components/files/FilesBreadcrumbs.tsx` — chevron + 階層強化
- `packages/web/src/components/files/FilesItem.tsx` — folder/file accent icon
- `packages/web/src/components/files/FilesViewerEmpty.tsx` — EmptyState 化
- `packages/web/src/components/files/FilesList.tsx` — empty state EmptyState 化
- `packages/web/src/components/terminal/TerminalHeader.tsx` — シンプル化 + Badge 化
- `packages/web/src/components/layout/MultiPaneArea.tsx` — pane 未割当 EmptyState
- `packages/web/src/components/settings/*.tsx` — Card 化、SystemStatus grid 化
- `packages/web/src/i18n/locales/*.json` (8 言語) — 新規キー追加

### Phase 6 で新規作成するファイル

**プリミティブ (F2):**
- `packages/web/src/components/ui/Card.tsx`
- `packages/web/src/components/ui/EmptyState.tsx`
- `packages/web/src/components/ui/Stepper.tsx`
- `packages/web/src/components/ui/Spinner.tsx`
- `packages/web/src/components/ui/Skeleton.tsx`
- `packages/web/src/components/ui/Badge.tsx`
- `packages/web/src/components/ui/IconButton.tsx`
- `packages/web/src/components/ui/__tests__/*.test.tsx` (7 件)

**アイコン基盤 (F3):**
- `packages/web/src/components/ui/icons/index.ts`

**構造 (G5):**
- `packages/web/src/components/LeftRail.tsx`
- `packages/web/src/components/__tests__/LeftRail.test.tsx`

**ログイン (G4):**
- `packages/web/src/components/login/OtpInput.tsx`
- `packages/web/src/components/login/__tests__/OtpInput.test.tsx`

**オンボーディング (H11):**
- `packages/web/src/components/onboarding/OnboardingGuide.tsx`
- `packages/web/src/components/onboarding/__tests__/OnboardingGuide.test.tsx`

**新規テスト:**
- `packages/web/src/theme/__tests__/tokens.test.ts` (contrast 検証)
- `tests/e2e/web/phase6-empty-states.spec.ts`
- `tests/manual/keyboard-tour.md`

### Phase 6 で削除するファイル

- (なし — 既存はすべて modify or 維持)

### 依存関係

```
F1 tokens
  ↓
F2 primitives ← F3 icons
  ↓
G5 LeftRail (構造変更)
  ↓
G4 Login, G6 Sessions, G7 Files, G8 Terminal, G9 Settings (順次)
  ↓
G10 EmptyState 統一
  ↓
H11 Onboarding
  ↓
H12 transitions / skeleton
  ↓
H13 focus ring + tooltip 統一
```

### Playwright E2E ポート

- Phase 6 新規 spec のポート: `18817`, TOKEN: `'4817'`
- 既存 a11y.spec.ts (18815) / phase5-coverage.spec.ts (18816) と衝突しない

### 非機能要件 (Phase 5b 水準維持)

- WCAG AA contrast >= 4.5:1
- i18n 8 言語 (en, ja, es, fr, de, pt-BR, zh-CN, ko) — 新規キーは全 locale に追加
- `prefers-reduced-motion: reduce` でアニメ無効
- bundle gzip +30KB 以内
- 既存 670 web unit / 143 gateway unit / 40 e2e すべて緑 維持

---

## Task F1: デザイントークン拡張

**Files:**
- Modify: `packages/web/src/theme/tokens.ts`
- Modify: `packages/web/src/theme/index.ts`
- Create: `packages/web/src/theme/__tests__/tokens.test.ts`

- [ ] **Step 1: Write failing contrast test**

```typescript
// packages/web/src/theme/__tests__/tokens.test.ts
import { describe, it, expect } from 'vitest';
import { darkTokens, lightTokens } from '../tokens';

function relLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}
function ratio(a: string, b: string): number {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('tokens contrast', () => {
  for (const [name, t] of [['dark', darkTokens], ['light', lightTokens]] as const) {
    it(`${name}: textPrimary/bg >= 4.5`, () => {
      expect(ratio(t.colors.textPrimary, t.colors.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: textSecondary/surface >= 4.5`, () => {
      expect(ratio(t.colors.textSecondary, t.colors.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: textMuted/bgElevated >= 4.5`, () => {
      expect(ratio(t.colors.textMuted, t.colors.bgElevated)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('exports shadows.sm/md/lg', () => {
    expect(darkTokens.shadows.sm).toMatch(/rgba/);
    expect(darkTokens.shadows.md).toMatch(/rgba/);
    expect(darkTokens.shadows.lg).toMatch(/rgba/);
  });
  it('exports focusRing color', () => {
    expect(darkTokens.colors.focusRing).toMatch(/^#/);
    expect(lightTokens.colors.focusRing).toMatch(/^#/);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test --workspace=@zenterm/web -- tokens.test`
Expected: FAIL — shadows / focusRing がまだ無い

- [ ] **Step 3: Extend tokens.ts**

```typescript
// packages/web/src/theme/tokens.ts に追加
export interface ColorTokens {
  // ... 既存
  surfaceSunken: string;
  overlay: string;        // modal backdrop (semi-transparent)
  focusRing: string;
}

export interface ThemeTokens {
  // ... 既存
  shadows: { sm: string; md: string; lg: string };
}

export const darkTokens: ThemeTokens = {
  colors: {
    // 既存維持
    bg: '#1B1A17',
    bgElevated: '#211F1B',
    surface: '#26241F',
    surfaceSunken: '#161512',  // 新規 = bg より少し暗い
    surfaceHover: '#302D27',
    border: '#3B3832',
    borderSubtle: '#2A2823',
    overlay: 'rgba(11, 10, 8, 0.6)',  // 新規
    textPrimary: '#DBD6C8',
    textSecondary: '#B0AB9B',
    textMuted: '#908A7E',
    textInverse: '#1B1A17',
    primary: '#94A687',
    primaryMuted: '#7B8B6F',
    primarySubtle: '#2C3328',
    success: '#94A687',
    warning: '#D4B86A',
    error: '#CC7070',
    focusRing: '#B6C8A4',
  },
  // ... spacing/radii/typography 既存維持
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.18)',
    md: '0 4px 12px rgba(0, 0, 0, 0.28)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.40)',
  },
};

export const lightTokens: ThemeTokens = {
  colors: {
    // 既存維持
    bg: '#F5F4F0',
    bgElevated: '#FBFAF6',
    surface: '#EFEDE7',
    surfaceSunken: '#E5E3DC',  // 新規
    surfaceHover: '#E5E3DC',
    border: '#CFCBC1',
    borderSubtle: '#DEDBD2',
    overlay: 'rgba(35, 33, 28, 0.40)',  // 新規
    textPrimary: '#2A2721',
    textSecondary: '#54504A',
    textMuted: '#736D60',  // 6F6960 から少し暗くして AA 維持
    textInverse: '#F5F4F0',
    primary: '#7B8B6F',
    primaryMuted: '#5C6E51',
    primarySubtle: '#E3E8DD',
    success: '#7B8B6F',
    warning: '#B89F56',
    error: '#B25A5A',
    focusRing: '#7B8B6F',
  },
  // ... 既存
  shadows: {
    sm: '0 1px 2px rgba(35, 33, 28, 0.08)',
    md: '0 4px 12px rgba(35, 33, 28, 0.12)',
    lg: '0 12px 32px rgba(35, 33, 28, 0.20)',
  },
};
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test --workspace=@zenterm/web -- tokens.test`
Expected: PASS (全 8 件)

- [ ] **Step 5: Run full web unit + a11y e2e**

Run:
```bash
npm test --workspace=@zenterm/web 2>&1 | tail -20
```
Expected: 既存 670+ unit すべて緑 + 新規 8 件 = 678+

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/theme/tokens.ts packages/web/src/theme/__tests__/tokens.test.ts packages/web/src/theme/index.ts
git commit -m "feat(web): extend theme tokens with shadows, surfaceSunken, overlay, focusRing

Phase 6 F1: 基盤トークン拡張。新規 shadow 3 段階 / surfaceSunken /
overlay / focusRing を追加。textMuted の light 値を AA に再調整。
WCAG AA contrast >= 4.5:1 をテストで保証。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task F2: 共通 UI プリミティブ追加

**Files:**
- Create: `packages/web/src/components/ui/Card.tsx`
- Create: `packages/web/src/components/ui/EmptyState.tsx`
- Create: `packages/web/src/components/ui/Stepper.tsx`
- Create: `packages/web/src/components/ui/Spinner.tsx`
- Create: `packages/web/src/components/ui/Skeleton.tsx`
- Create: `packages/web/src/components/ui/Badge.tsx`
- Create: `packages/web/src/components/ui/IconButton.tsx`
- Create: `packages/web/src/components/ui/__tests__/*.test.tsx` (7 件)

- [ ] **Step 1: Write Card test (TDD pattern; 他プリミティブも同様の構造)**

```typescript
// packages/web/src/components/ui/__tests__/Card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { Card } from '../Card';

function w(c: React.ReactNode) { return <ThemeProvider>{c}</ThemeProvider>; }

describe('Card', () => {
  it('renders children', () => {
    render(w(<Card>Hello</Card>));
    expect(screen.getByText('Hello')).toBeTruthy();
  });
  it('applies variant="elevated" with shadow', () => {
    const { container } = render(w(<Card variant="elevated">x</Card>));
    expect(container.firstChild).toHaveAttribute('data-variant', 'elevated');
  });
  it('applies variant="outline" without shadow', () => {
    const { container } = render(w(<Card variant="outline">x</Card>));
    expect(container.firstChild).toHaveAttribute('data-variant', 'outline');
  });
  it('forwards aria-label', () => {
    render(w(<Card aria-label="panel">x</Card>));
    expect(screen.getByLabelText('panel')).toBeTruthy();
  });
  it('renders as role="region" when label given', () => {
    render(w(<Card aria-label="panel">x</Card>));
    expect(screen.getByRole('region')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement Card**

```typescript
// packages/web/src/components/ui/Card.tsx
import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export type CardVariant = 'elevated' | 'outline' | 'plain';
export interface CardProps {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  style?: React.CSSProperties;
}

export function Card({
  variant = 'elevated',
  padding = 'md',
  children,
  style,
  ...aria
}: CardProps) {
  const { tokens } = useTheme();
  const padPx = { sm: tokens.spacing.sm, md: tokens.spacing.lg, lg: tokens.spacing['2xl'] }[padding];
  const shadow = variant === 'elevated' ? tokens.shadows.sm : 'none';
  const border = variant === 'outline' ? `1px solid ${tokens.colors.border}` : 'none';
  const hasLabel = !!aria['aria-label'] || !!aria['aria-labelledby'];
  return (
    <div
      role={hasLabel ? 'region' : undefined}
      data-variant={variant}
      {...aria}
      style={{
        background: tokens.colors.bgElevated,
        borderRadius: tokens.radii.lg,
        padding: padPx,
        boxShadow: shadow,
        border,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Implement EmptyState**

```typescript
// packages/web/src/components/ui/EmptyState.tsx
import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md';
}

export function EmptyState({ icon, title, description, action, size = 'md' }: EmptyStateProps) {
  const { tokens } = useTheme();
  const padY = size === 'sm' ? tokens.spacing.xl : tokens.spacing['4xl'];
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacing.md,
        padding: `${padY}px ${tokens.spacing.lg}px`,
        textAlign: 'center',
        color: tokens.colors.textMuted,
      }}
    >
      {icon && <div style={{ color: tokens.colors.primaryMuted, fontSize: 32 }}>{icon}</div>}
      <div style={{ fontSize: tokens.typography.heading.fontSize, fontWeight: 600, color: tokens.colors.textSecondary }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: tokens.typography.small.fontSize, maxWidth: 320 }}>{description}</div>
      )}
      {action && <div style={{ marginTop: tokens.spacing.sm }}>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Implement Stepper / Spinner / Skeleton / Badge / IconButton**

```typescript
// packages/web/src/components/ui/Stepper.tsx
import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export interface StepperStep { title: string; description?: ReactNode; status: 'pending' | 'current' | 'done'; }
export interface StepperProps { steps: StepperStep[]; }

export function Stepper({ steps }: StepperProps) {
  const { tokens } = useTheme();
  return (
    <ol role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
      {steps.map((s, i) => (
        <li key={i} aria-current={s.status === 'current' ? 'step' : undefined} style={{ display: 'flex', gap: tokens.spacing.md, alignItems: 'flex-start' }}>
          <div
            aria-hidden
            style={{
              width: 28, height: 28, borderRadius: 14,
              background: s.status === 'done' ? tokens.colors.primary : s.status === 'current' ? tokens.colors.primarySubtle : tokens.colors.surface,
              color: s.status === 'done' ? tokens.colors.textInverse : tokens.colors.textPrimary,
              border: `1px solid ${s.status === 'current' ? tokens.colors.primary : tokens.colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: tokens.typography.smallMedium.fontSize, fontWeight: 600, flexShrink: 0,
            }}
          >
            {s.status === 'done' ? '✓' : i + 1}
          </div>
          <div>
            <div style={{ fontSize: tokens.typography.bodyMedium.fontSize, fontWeight: 600, color: tokens.colors.textPrimary }}>{s.title}</div>
            {s.description && <div style={{ marginTop: tokens.spacing.xs, fontSize: tokens.typography.small.fontSize, color: tokens.colors.textSecondary }}>{s.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
```

```typescript
// packages/web/src/components/ui/Spinner.tsx
import { useTheme } from '@/theme';

export interface SpinnerProps { size?: number; 'aria-label'?: string; }

export function Spinner({ size = 16, 'aria-label': label = 'Loading' }: SpinnerProps) {
  const { tokens } = useTheme();
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block', width: size, height: size,
        border: `2px solid ${tokens.colors.borderSubtle}`,
        borderTopColor: tokens.colors.primary,
        borderRadius: '50%',
        animation: 'zen-spin 0.6s linear infinite',
      }}
    />
  );
}
// @keyframes zen-spin は packages/web/src/index.css に追加
```

```typescript
// packages/web/src/components/ui/Skeleton.tsx
import { useTheme } from '@/theme';

export interface SkeletonProps { width?: number | string; height?: number; radius?: number; }

export function Skeleton({ width = '100%', height = 16, radius = 4 }: SkeletonProps) {
  const { tokens } = useTheme();
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block', width, height,
        background: tokens.colors.surface,
        borderRadius: radius,
        position: 'relative', overflow: 'hidden',
      }}
    />
  );
}
```

```typescript
// packages/web/src/components/ui/Badge.tsx
import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
export interface BadgeProps { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; }

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  const { tokens } = useTheme();
  const bg = {
    neutral: tokens.colors.surface,
    success: tokens.colors.primarySubtle,
    warning: tokens.colors.surface,
    error: tokens.colors.surface,
    info: tokens.colors.surface,
  }[tone];
  const fg = {
    neutral: tokens.colors.textSecondary,
    success: tokens.colors.primary,
    warning: tokens.colors.warning,
    error: tokens.colors.error,
    info: tokens.colors.textSecondary,
  }[tone];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: tokens.spacing.xs,
        padding: `2px ${tokens.spacing.sm}px`,
        background: bg, color: fg,
        borderRadius: 999,
        fontSize: tokens.typography.small.fontSize, fontWeight: 500,
        border: `1px solid ${tokens.colors.borderSubtle}`,
      }}
      data-tone={tone}
    >
      {icon && <span aria-hidden style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </span>
  );
}
```

```typescript
// packages/web/src/components/ui/IconButton.tsx
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { useTheme } from '@/theme';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode;
  label: string;            // required: aria-label and tooltip
  variant?: 'ghost' | 'outline' | 'primary' | 'danger';
  size?: 'sm' | 'md';
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', ...rest }: IconButtonProps) {
  const { tokens } = useTheme();
  const dim = size === 'sm' ? 28 : 36;
  const bg = {
    ghost: 'transparent',
    outline: 'transparent',
    primary: tokens.colors.primary,
    danger: 'transparent',
  }[variant];
  const fg = {
    ghost: tokens.colors.textSecondary,
    outline: tokens.colors.textPrimary,
    primary: tokens.colors.textInverse,
    danger: tokens.colors.error,
  }[variant];
  const border = variant === 'outline' ? `1px solid ${tokens.colors.border}` : variant === 'danger' ? `1px solid ${tokens.colors.error}` : 'none';
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        {...rest}
        style={{
          width: dim, height: dim,
          background: bg, color: fg, border,
          borderRadius: tokens.radii.md,
          cursor: rest.disabled ? 'not-allowed' : 'pointer',
          opacity: rest.disabled ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          ...(rest.style ?? {}),
        }}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
```

- [ ] **Step 5: Add zen-spin keyframe to global CSS**

```css
/* packages/web/src/index.css に追加 */
@keyframes zen-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes zen-spin { from, to { transform: none; } }
}
```

- [ ] **Step 6: Write minimal test per primitive**

各 primitive で render + variant + a11y を確認するテスト 5 件ずつ。Card と同じパターン。

- [ ] **Step 7: Run all tests**

Run: `npm test --workspace=@zenterm/web -- --run ui`
Expected: 35+ 新規テスト全 PASS

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/components/ui/{Card,EmptyState,Stepper,Spinner,Skeleton,Badge,IconButton}.tsx packages/web/src/components/ui/__tests__/*.test.tsx packages/web/src/index.css
git commit -m "feat(web): add Card/EmptyState/Stepper/Spinner/Skeleton/Badge/IconButton primitives

Phase 6 F2: UI 完成度の基盤プリミティブ 7 件。WCAG AA / reduced-motion
対応。35 件のユニットテスト付き。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task F3: アイコン基盤統一 (lucide-react)

**Files:**
- Modify: `packages/web/package.json`
- Create: `packages/web/src/components/ui/icons/index.ts`

- [ ] **Step 1: Add lucide-react dependency**

```bash
npm install --workspace=@zenterm/web lucide-react@^0.460.0
```

- [ ] **Step 2: Create icon barrel**

```typescript
// packages/web/src/components/ui/icons/index.ts
export {
  Terminal as IconTerminal,
  Folder as IconFolder,
  FolderOpen as IconFolderOpen,
  File as IconFile,
  FileText as IconFileText,
  Settings as IconSettings,
  Plus as IconPlus,
  ChevronRight as IconChevronRight,
  ChevronDown as IconChevronDown,
  Search as IconSearch,
  Copy as IconCopy,
  Trash2 as IconTrash,
  Upload as IconUpload,
  Download as IconDownload,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  ArrowUpDown as IconSort,
  RefreshCw as IconRefresh,
  LogOut as IconLogout,
  Wifi as IconWifi,
  WifiOff as IconWifiOff,
  Loader2 as IconLoader,
  X as IconX,
  Check as IconCheck,
  Info as IconInfo,
  AlertTriangle as IconAlertTriangle,
  XCircle as IconXCircle,
  Rocket as IconRocket,
  QrCode as IconQrCode,
  Home as IconHome,
  Edit3 as IconEdit,
  MoreHorizontal as IconMore,
  PanelLeft as IconSidebar,
  Power as IconPower,
} from 'lucide-react';

import type { LucideProps } from 'lucide-react';
export type IconProps = LucideProps;
```

- [ ] **Step 3: Verify bundle size impact**

Run:
```bash
npm run build --workspace=@zenterm/web 2>&1 | tail -20
ls -la packages/web/dist/assets/*.js | awk '{print $5, $9}'
```
Expected: 最大 chunk gzip 増加 +20〜25KB 以内 (lucide tree-shaking 効くので使用分のみ)

- [ ] **Step 4: Smoke test import**

```typescript
// packages/web/src/components/ui/icons/__tests__/icons.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IconTerminal, IconFolder, IconRocket } from '../index';

describe('icons barrel', () => {
  it('renders IconTerminal as svg', () => {
    const { container } = render(<IconTerminal size={16} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('renders IconFolder', () => {
    const { container } = render(<IconFolder size={16} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('renders IconRocket', () => {
    const { container } = render(<IconRocket size={32} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test --workspace=@zenterm/web -- icons`
Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/package.json packages/web/package-lock.json packages/web/src/components/ui/icons/
git commit -m "feat(web): add lucide-react icon barrel (Phase 6 F3)

icon basis を Unicode 雑居から lucide-react に統一。
gzip bundle 増加は本タスク単独で +20KB 程度 (使用箇所追加で増減)。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task G5: LeftRail 構造変更

**Files:**
- Create: `packages/web/src/components/LeftRail.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx` (453 行のうちフッタタブ部分を削除し LeftRail に置換)
- Create: `packages/web/src/components/__tests__/LeftRail.test.tsx`

- [ ] **Step 1: Write LeftRail test**

```typescript
// packages/web/src/components/__tests__/LeftRail.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/theme';
import { LeftRail } from '../LeftRail';

function w(c: React.ReactNode) { return <ThemeProvider>{c}</ThemeProvider>; }

describe('LeftRail', () => {
  it('renders sessions/files/settings tabs', () => {
    render(w(<LeftRail activeTab="sessions" onSelectTab={() => {}} onLogout={() => {}} rateLimitsWarning={false} />));
    expect(screen.getByRole('tab', { name: /sessions/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /files/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /settings/i })).toBeTruthy();
  });
  it('marks active tab aria-selected=true', () => {
    render(w(<LeftRail activeTab="files" onSelectTab={() => {}} onLogout={() => {}} rateLimitsWarning={false} />));
    const files = screen.getByRole('tab', { name: /files/i });
    expect(files.getAttribute('aria-selected')).toBe('true');
  });
  it('calls onSelectTab when tab clicked', async () => {
    const handler = vi.fn();
    render(w(<LeftRail activeTab="sessions" onSelectTab={handler} onLogout={() => {}} rateLimitsWarning={false} />));
    await userEvent.click(screen.getByRole('tab', { name: /files/i }));
    expect(handler).toHaveBeenCalledWith('files');
  });
  it('shows warning dot on settings when rateLimitsWarning=true', () => {
    render(w(<LeftRail activeTab="sessions" onSelectTab={() => {}} onLogout={() => {}} rateLimitsWarning={true} />));
    expect(screen.getByLabelText(/rate limits warning/i)).toBeTruthy();
  });
  it('renders logout button', () => {
    render(w(<LeftRail activeTab="sessions" onSelectTab={() => {}} onLogout={() => {}} rateLimitsWarning={false} />));
    expect(screen.getByRole('button', { name: /logout/i })).toBeTruthy();
  });
  it('keyboard ArrowDown moves focus to next tab', async () => {
    render(w(<LeftRail activeTab="sessions" onSelectTab={() => {}} onLogout={() => {}} rateLimitsWarning={false} />));
    const sessions = screen.getByRole('tab', { name: /sessions/i });
    sessions.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /files/i }));
  });
});
```

- [ ] **Step 2: Implement LeftRail**

```typescript
// packages/web/src/components/LeftRail.tsx
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { IconTerminal, IconFolder, IconSettings, IconLogout } from './ui/icons';
import { Tooltip } from './ui/Tooltip';

export type ShellTab = 'sessions' | 'files' | 'settings';
export interface LeftRailProps {
  activeTab: ShellTab;
  onSelectTab: (tab: ShellTab) => void;
  onLogout: () => void;
  rateLimitsWarning: boolean;
}

const TABS: { id: ShellTab; iconKey: 'terminal' | 'folder' | 'settings' }[] = [
  { id: 'sessions', iconKey: 'terminal' },
  { id: 'files', iconKey: 'folder' },
  { id: 'settings', iconKey: 'settings' },
];

const ICONS = { terminal: IconTerminal, folder: IconFolder, settings: IconSettings };

export function LeftRail({ activeTab, onSelectTab, onLogout, rateLimitsWarning }: LeftRailProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const refs = useRef<Record<ShellTab, HTMLButtonElement | null>>({ sessions: null, files: null, settings: null });

  const handleKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (idx + (e.key === 'ArrowDown' ? 1 : -1) + TABS.length) % TABS.length;
      refs.current[TABS[next].id]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectTab(TABS[idx].id);
    }
  };

  return (
    <nav
      role="tablist"
      aria-orientation="vertical"
      aria-label={t('shell.leftRail.label')}
      style={{
        width: 64,
        background: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: `${tokens.spacing.md}px 0`,
      }}
    >
      {TABS.map(({ id, iconKey }, i) => {
        const Icon = ICONS[iconKey];
        const active = activeTab === id;
        return (
          <Tooltip key={id} label={t(`shell.tabs.${id}`)} placement="right">
            <button
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${id}`}
              tabIndex={active ? 0 : -1}
              ref={(el) => { refs.current[id] = el; }}
              onClick={() => onSelectTab(id)}
              onKeyDown={(e) => handleKey(e, i)}
              style={{
                position: 'relative',
                width: 44, height: 44,
                background: active ? tokens.colors.primarySubtle : 'transparent',
                color: active ? tokens.colors.primary : tokens.colors.textMuted,
                border: 'none',
                borderRadius: tokens.radii.md,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon size={20} aria-hidden />
              {id === 'settings' && rateLimitsWarning && (
                <span
                  aria-label={t('shell.leftRail.rateLimitsWarning')}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 8, height: 8, borderRadius: '50%',
                    background: tokens.colors.warning,
                  }}
                />
              )}
            </button>
          </Tooltip>
        );
      })}
      <div style={{ flex: 1 }} />
      <Tooltip label={t('shell.tabs.logout')} placement="right">
        <button
          type="button"
          aria-label={t('shell.tabs.logout')}
          onClick={onLogout}
          style={{
            width: 44, height: 44,
            background: 'transparent',
            color: tokens.colors.textMuted,
            border: 'none',
            borderRadius: tokens.radii.md,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconLogout size={20} aria-hidden />
        </button>
      </Tooltip>
    </nav>
  );
}
```

- [ ] **Step 3: Integrate into AuthenticatedShell**

`AuthenticatedShell.tsx` のフッタタブ JSX を `<LeftRail .../>` に置換。レイアウトを `flex-direction: row` の 3 zone (`<LeftRail>` `<aside SidebarPanel>` `<main>`) に再構成。Logout / rate-limits 状態を取得して props 流し込み。

- [ ] **Step 4: Add i18n keys**

`packages/web/src/i18n/locales/{en,ja,es,fr,de,pt-BR,zh-CN,ko}.json` に追加:

```json
{
  "shell": {
    "leftRail": {
      "label": "Primary navigation",
      "rateLimitsWarning": "Rate limits warning"
    },
    "tabs": {
      "sessions": "Sessions",
      "files": "Files",
      "settings": "Settings",
      "logout": "Logout"
    }
  }
}
```

ja は "プライマリナビゲーション" / "レート制限の警告" / "セッション" / "ファイル" / "設定" / "ログアウト"。他言語は英語を fallback として投入し、機械翻訳禁止 = 英語値のまま投入で OK (translation team が後で追う)。

- [ ] **Step 5: Update existing e2e selectors**

`tests/e2e/web/*.spec.ts` で `role="navigation"` を期待していた箇所を `role="tablist"` (aria-orientation="vertical") に更新。具体的には:
- `tests/e2e/web/files-browse.spec.ts`
- `tests/e2e/web/sessions.spec.ts` (あれば)
- 各 spec で `nav.locator('text=Files')` などのフッタタブ前提を `role="tab"` ベースに変更

- [ ] **Step 6: Run all tests**

```bash
npm test --workspace=@zenterm/web 2>&1 | tail -30
npx playwright test --project=web-pc 2>&1 | tail -30
```
Expected: 全 unit 緑、e2e 既存退行は selector 更新後 0 件

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/LeftRail.tsx packages/web/src/components/__tests__/LeftRail.test.tsx packages/web/src/components/AuthenticatedShell.tsx packages/web/src/i18n/locales/ tests/e2e/web/
git commit -m "refactor(web): replace footer tabs with vertical LeftRail (Phase 6 G5)

64px 縦タブバー (Sessions / Files / Settings + Logout) を導入。
keyboard ArrowUp/Down ナビ + aria-selected + tooltip 完備。
既存 e2e selector を tablist 構造に更新。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task G4: Login 画面リフレッシュ (OTP マス入力)

**Files:**
- Create: `packages/web/src/components/login/OtpInput.tsx`
- Create: `packages/web/src/components/login/__tests__/OtpInput.test.tsx`
- Modify: `packages/web/src/components/LoginForm.tsx`
- Modify: `packages/web/src/i18n/locales/*.json` (`login.tagline` 追加)

- [ ] **Step 1: Write OtpInput test**

```typescript
// packages/web/src/components/login/__tests__/OtpInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/theme';
import { OtpInput } from '../OtpInput';

function w(c: React.ReactNode) { return <ThemeProvider>{c}</ThemeProvider>; }

describe('OtpInput', () => {
  it('renders 4 input boxes', () => {
    render(w(<OtpInput value="" onChange={() => {}} />));
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });
  it('typing digit moves focus to next box', async () => {
    const handler = vi.fn();
    render(w(<OtpInput value="" onChange={handler} />));
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await userEvent.keyboard('1');
    expect(handler).toHaveBeenCalledWith('1');
    expect(document.activeElement).toBe(boxes[1]);
  });
  it('Backspace clears current and moves focus back', async () => {
    const handler = vi.fn();
    render(w(<OtpInput value="12" onChange={handler} />));
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[2].focus();
    await userEvent.keyboard('{Backspace}');
    expect(handler).toHaveBeenCalledWith('1');
    expect(document.activeElement).toBe(boxes[1]);
  });
  it('paste fills all 4 boxes', async () => {
    const handler = vi.fn();
    render(w(<OtpInput value="" onChange={handler} />));
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await userEvent.paste('1234');
    expect(handler).toHaveBeenCalledWith('1234');
  });
  it('non-digit input is ignored', async () => {
    const handler = vi.fn();
    render(w(<OtpInput value="" onChange={handler} />));
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await userEvent.keyboard('a');
    expect(handler).not.toHaveBeenCalled();
  });
  it('ArrowLeft / ArrowRight move focus', async () => {
    render(w(<OtpInput value="" onChange={() => {}} />));
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[2].focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(boxes[1]);
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(boxes[2]);
  });
});
```

- [ ] **Step 2: Implement OtpInput**

```typescript
// packages/web/src/components/login/OtpInput.tsx
import { useRef, useEffect, type ClipboardEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { useTheme } from '@/theme';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
}

export function OtpInput({ length = 4, value, onChange, autoFocus, ...aria }: OtpInputProps) {
  const { tokens } = useTheme();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i: number, ch: string) => {
    const digits = value.padEnd(length, ' ').slice(0, length).split('');
    digits[i] = ch;
    const next = digits.join('').trimEnd();
    onChange(next);
  };

  const handleChange = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    setAt(i, raw[raw.length - 1]);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        setAt(i, '');
      } else if (i > 0) {
        setAt(i - 1, '');
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={aria['aria-label'] ?? 'Token input'}
      style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'center' }}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={handleChange(i)}
          onKeyDown={handleKey(i)}
          onPaste={handlePaste}
          aria-invalid={aria['aria-invalid']}
          aria-label={`Digit ${i + 1}`}
          style={{
            width: 56, height: 64,
            fontSize: 28,
            textAlign: 'center',
            fontFamily: tokens.typography.mono.fontFamily,
            background: tokens.colors.bg,
            color: tokens.colors.textPrimary,
            border: `2px solid ${value[i] ? tokens.colors.primary : tokens.colors.border}`,
            borderRadius: tokens.radii.md,
            outline: 'none',
            transition: 'border-color 120ms',
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Refresh LoginForm**

```typescript
// packages/web/src/components/LoginForm.tsx (置換)
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { OtpInput } from './login/OtpInput';
import { Card } from './ui/Card';
import { IconTerminal, IconAlertTriangle } from './ui/icons';

export interface LoginFormProps {
  onSubmit: (token: string) => Promise<void>;
  gatewayUrl?: string;
}

export function LoginForm({ onSubmit, gatewayUrl }: LoginFormProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (token.length !== 4) return;
    setSubmitting(true); setError(null);
    try { await onSubmit(token); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <Card variant="elevated" padding="lg" style={{ width: '100%', maxWidth: 420 }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.lg }}>
          <div style={{ color: tokens.colors.primary }}>
            <IconTerminal size={36} aria-hidden />
          </div>
          <h2 style={{ margin: 0, fontSize: tokens.typography.heading.fontSize, color: tokens.colors.textPrimary }}>
            {t('login.title')}
          </h2>
          <p style={{ margin: 0, fontSize: tokens.typography.small.fontSize, color: tokens.colors.textMuted, textAlign: 'center' }}>
            {t('login.tagline')}
          </p>
        </div>

        {gatewayUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: tokens.spacing.lg }}>
            <span style={{
              fontSize: tokens.typography.small.fontSize, color: tokens.colors.textSecondary,
              fontFamily: tokens.typography.mono.fontFamily,
              padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
              background: tokens.colors.surface, borderRadius: tokens.radii.sm,
            }}>{gatewayUrl}</span>
          </div>
        )}

        <div style={{ marginBottom: tokens.spacing.md }}>
          <label style={{
            display: 'block', textAlign: 'center', marginBottom: tokens.spacing.sm,
            fontSize: tokens.typography.smallMedium.fontSize, color: tokens.colors.textSecondary,
          }}>{t('login.tokenLabel')}</label>
          <OtpInput
            value={token}
            onChange={setToken}
            autoFocus
            aria-invalid={Boolean(error)}
            aria-label={t('login.tokenLabel')}
          />
        </div>

        {error && (
          <div role="alert" style={{
            display: 'flex', alignItems: 'center', gap: tokens.spacing.sm,
            color: tokens.colors.error, fontSize: tokens.typography.small.fontSize,
            marginBottom: tokens.spacing.md,
          }}>
            <IconAlertTriangle size={16} aria-hidden /><span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={token.length !== 4 || submitting}
          style={{
            width: '100%', padding: tokens.spacing.md,
            background: tokens.colors.primary, color: tokens.colors.textInverse,
            border: 'none', borderRadius: tokens.radii.md,
            fontSize: tokens.typography.bodyMedium.fontSize, fontWeight: 600,
            cursor: token.length === 4 && !submitting ? 'pointer' : 'not-allowed',
            opacity: token.length === 4 && !submitting ? 1 : 0.5,
            boxShadow: tokens.shadows.sm,
          }}
        >
          {submitting ? '…' : t('login.submit')}
        </button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 4: Add i18n keys**

`login.tagline` を 8 言語に追加。en: `"Connect to your tmux server from anywhere"`、ja: `"どこからでも tmux サーバーに接続"`、他は en fallback。

- [ ] **Step 5: Run tests**

Run: `npm test --workspace=@zenterm/web -- login`
Expected: OtpInput 6 件 + LoginForm 既存テストの更新 (placeholder セレクタを削除し、aria-label セレクタへ) すべて緑

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/login/ packages/web/src/components/LoginForm.tsx packages/web/src/i18n/locales/
git commit -m "feat(web): redesign Login with logo + tagline + OTP input (Phase 6 G4)

OTP 4 桁マス入力 (paste / 矢印キー / Backspace 連動)。
ロゴ + tagline + Gateway chip + alert アイコンで第一印象を改善。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task G6: Sessions リスト再構成

**Files:**
- Modify: `packages/web/src/components/SessionsListPanel.tsx`
- Modify: `packages/web/src/components/sidebar/SessionRow.tsx`
- Modify: `packages/web/src/components/sidebar/NewSessionButton.tsx`
- Modify: `packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx`

- [ ] **Step 1: Update SessionRow test**

新規 assertion を追加:
- 行が `Card` で囲まれていること (role="region" もしくは data-variant)
- 状態ドット (`success`/`warning`/`muted`) が aria-label 付きで表示
- chevron icon があること
- relative time 表示 (windows[0].activity から計算) があるなら表示、なければ非表示

```typescript
it('renders state dot with aria-label "active"', () => {
  render(w(<SessionRow session={{ ...mock, attached: true }} ... />));
  expect(screen.getByLabelText(/active/i)).toBeTruthy();
});
it('renders chevron icon', () => {
  render(w(<SessionRow session={mock} ... />));
  expect(screen.getByTestId('session-row-chevron')).toBeTruthy();
});
```

- [ ] **Step 2: Refactor SessionRow**

```typescript
// SessionRow.tsx 主要部
import { Card } from '../ui/Card';
import { IconChevronRight, IconChevronDown } from '../ui/icons';

const stateColor = (session: TmuxSession): { bg: string; label: string } => {
  if (session.attached) return { bg: tokens.colors.primary, label: t('sessions.state.active') };
  if (session.windows?.length) return { bg: tokens.colors.warning, label: t('sessions.state.idle') };
  return { bg: tokens.colors.textMuted, label: t('sessions.state.detached') };
};

return (
  <Card variant={isActive ? 'elevated' : 'plain'} padding="sm" style={{ marginBottom: tokens.spacing.xs }}>
    <button
      type="button"
      onClick={...}
      style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
    >
      <span aria-label={state.label} style={{ width: 8, height: 8, borderRadius: '50%', background: state.bg, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: tokens.typography.bodyMedium.fontSize, fontWeight: 600, color: tokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.displayName}
        </div>
        <div style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textMuted, fontFamily: tokens.typography.mono.fontFamily, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.cwd ?? '~'}
        </div>
      </div>
      <span data-testid="session-row-chevron" aria-hidden style={{ color: tokens.colors.textMuted }}>
        {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
      </span>
    </button>
  </Card>
);
```

- [ ] **Step 3: Refactor NewSessionButton (pill 化)**

primary 塗りつぶし + `+` icon 付きのピル形ボタンに。リスト下部のままでも、視覚的に強い CTA に。

- [ ] **Step 4: Update SessionsListPanel header**

`Active · N` を heading サイズに昇格。`+ New Session` ボタンをヘッダ右側に配置。

- [ ] **Step 5: Add i18n state keys**

```json
{ "sessions": { "state": { "active": "Active", "idle": "Idle", "detached": "Detached" } } }
```

- [ ] **Step 6: Run tests**

Run: `npm test --workspace=@zenterm/web -- SessionRow SessionsListPanel`
Expected: 全 PASS (退行 0)

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(web): Session row Card layout + state dot + chevron (Phase 6 G6)"
```

---

## Task G7: Files ページ刷新

**Files:**
- Modify: `packages/web/src/components/files/FilesToolbar.tsx`
- Modify: `packages/web/src/components/files/FilesBreadcrumbs.tsx`
- Modify: `packages/web/src/components/files/FilesItem.tsx`
- Modify: `packages/web/src/components/files/FilesList.tsx`
- Modify: `packages/web/src/components/files/FilesViewerEmpty.tsx`
- Modify: 関連 `__tests__/*.test.tsx`

- [ ] **Step 1: Update FilesToolbar**

```typescript
import { IconButton } from '../ui/IconButton';
import { IconSort, IconEye, IconEyeOff, IconUpload, IconPlus } from '../ui/icons';

return (
  <div style={{
    display: 'flex', gap: tokens.spacing.xs, alignItems: 'center',
    padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
    borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
  }}>
    <IconButton icon={<IconSort size={18} />} label={t('files.sort')} onClick={onSort} />
    <IconButton
      icon={showHidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
      label={t('files.toggleHidden')}
      onClick={onToggleHidden}
    />
    <div style={{ flex: 1 }} />
    <IconButton icon={<IconUpload size={18} />} label={t('files.upload')} variant="outline" onClick={onUpload} />
    <IconButton icon={<IconPlus size={18} />} label={t('files.new')} variant="primary" onClick={onNew} />
  </div>
);
```

- [ ] **Step 2: Update FilesBreadcrumbs**

```typescript
import { IconHome, IconChevronRight } from '../ui/icons';

return (
  <nav aria-label={t('files.breadcrumb')} style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs, padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`, overflow: 'hidden' }}>
    <button onClick={() => onNavigate('/')} aria-label={t('files.home')} style={{ background: 'transparent', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer', display: 'inline-flex' }}>
      <IconHome size={14} />
    </button>
    {segments.map((seg, i) => {
      const isLast = i === segments.length - 1;
      return (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs, minWidth: 0 }}>
          <IconChevronRight size={12} aria-hidden style={{ color: tokens.colors.textMuted, flexShrink: 0 }} />
          <button
            onClick={() => onNavigate(seg.path)}
            aria-current={isLast ? 'page' : undefined}
            style={{
              background: 'transparent', border: 'none', cursor: isLast ? 'default' : 'pointer',
              color: isLast ? tokens.colors.textPrimary : tokens.colors.textSecondary,
              fontWeight: isLast ? 600 : 400,
              fontSize: tokens.typography.small.fontSize,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >{seg.name}</button>
        </span>
      );
    })}
  </nav>
);
```

- [ ] **Step 3: Update FilesItem**

```typescript
import { IconFolder, IconFile, IconChevronRight } from '../ui/icons';

const Icon = item.kind === 'directory' ? IconFolder : IconFile;
const iconColor = item.kind === 'directory' ? tokens.colors.primaryMuted : tokens.colors.textSecondary;

return (
  <button
    type="button"
    role="option"
    aria-selected={isSelected}
    onClick={onSelect}
    onContextMenu={onContextMenu}
    style={{
      display: 'flex', alignItems: 'center', gap: tokens.spacing.md,
      width: '100%', padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
      background: isSelected ? tokens.colors.surfaceHover : 'transparent',
      border: 'none', cursor: 'pointer', textAlign: 'left',
    }}
  >
    <Icon size={18} aria-hidden style={{ color: iconColor, flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: tokens.typography.bodyMedium.fontSize, color: tokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.name}
      </div>
      <div style={{ fontSize: tokens.typography.caption.fontSize, color: tokens.colors.textMuted }}>
        {item.kind === 'directory' ? '—' : formatSize(item.size)} · {formatRelative(item.mtime)}
      </div>
    </div>
    {item.kind === 'directory' && <IconChevronRight size={14} aria-hidden style={{ color: tokens.colors.textMuted }} />}
  </button>
);
```

- [ ] **Step 4: Update FilesList empty + FilesViewerEmpty (EmptyState 化)**

```typescript
// FilesList.tsx の empty 部分
import { EmptyState } from '../ui/EmptyState';
import { IconFolderOpen } from '../ui/icons';

if (!loading && entries.length === 0) {
  return <EmptyState icon={<IconFolderOpen size={32} />} title={t('files.empty.title')} description={t('files.empty.description')} size="sm" />;
}
```

```typescript
// FilesViewerEmpty.tsx (置換)
import { EmptyState } from '../ui/EmptyState';
import { IconFileText } from '../ui/icons';
import { useTranslation } from 'react-i18next';

export function FilesViewerEmpty() {
  const { t } = useTranslation();
  return <EmptyState icon={<IconFileText size={32} />} title={t('files.viewerEmpty.title')} description={t('files.viewerEmpty.description')} />;
}
```

- [ ] **Step 5: Add i18n keys**

```json
{
  "files": {
    "sort": "Sort", "toggleHidden": "Toggle hidden files", "upload": "Upload", "new": "New",
    "home": "Home", "breadcrumb": "Files breadcrumbs",
    "empty": { "title": "Empty directory", "description": "Drag files here to upload" },
    "viewerEmpty": { "title": "No file selected", "description": "Select a file in the sidebar to preview" }
  }
}
```

- [ ] **Step 6: Update existing tests + e2e**

`tests/e2e/web/files-browse.spec.ts` 等の selector を `getByLabel('Sort')` 等の aria 経由に。Tooltip 経由のラベルで揃える。

- [ ] **Step 7: Run tests**

Run:
```bash
npm test --workspace=@zenterm/web -- files
npx playwright test --project=web-pc files-browse files-copy-paste 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(web): refresh Files toolbar/breadcrumb/item with icons (Phase 6 G7)"
```

---

## Task G8: Terminal Header シンプル化

**Files:**
- Modify: `packages/web/src/components/terminal/TerminalHeader.tsx`
- Modify: `packages/web/src/components/terminal/__tests__/TerminalHeader.test.tsx`

- [ ] **Step 1: Update tests**

```typescript
it('shows session name as heading', () => { /* ... */ });
it('shows window index in muted text', () => { /* ... */ });
it('shows Connected Badge when connected', () => {
  expect(screen.getByText(/connected/i).closest('[data-tone="success"]')).toBeTruthy();
});
it('exposes pane index in aria-label only', () => {
  const region = screen.getByRole('region');
  expect(region.getAttribute('aria-label')).toMatch(/pane 1/i);
});
```

- [ ] **Step 2: Rewrite header**

```typescript
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';
import { IconRefresh, IconWifi, IconWifiOff } from '../ui/icons';

return (
  <div
    role="region"
    aria-label={t('terminal.paneLabel', { index: paneIndex + 1, session: sessionId, window: windowIndex })}
    style={{
      display: 'flex', alignItems: 'center', gap: tokens.spacing.md,
      padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
      borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
    }}
  >
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: tokens.spacing.sm }}>
      <span style={{ fontSize: tokens.typography.smallMedium.fontSize, fontWeight: 600, color: tokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sessionId}
      </span>
      <span style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textMuted }}>
        w{windowIndex}
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
      <button onClick={onDecFont} aria-label={t('terminal.fontDec')} style={fontBtnStyle}>−</button>
      <span style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textSecondary, minWidth: 24, textAlign: 'center' }}>{fontSize}</span>
      <button onClick={onIncFont} aria-label={t('terminal.fontInc')} style={fontBtnStyle}>+</button>
    </div>
    <IconButton icon={<IconRefresh size={14} />} label={t('terminal.reconnect')} onClick={onReconnect} size="sm" />
    <Badge tone={connected ? 'success' : 'error'} icon={connected ? <IconWifi size={12} /> : <IconWifiOff size={12} />}>
      {connected ? t('terminal.connected') : t('terminal.disconnected')}
    </Badge>
  </div>
);
```

- [ ] **Step 3: Update i18n**

```json
{ "terminal": { "paneLabel": "Pane {{index}} — {{session}}/w{{window}}", "fontDec": "Decrease font size", "fontInc": "Increase font size", "reconnect": "Reconnect", "connected": "Connected", "disconnected": "Disconnected" } }
```

- [ ] **Step 4: Run tests + commit**

```bash
npm test --workspace=@zenterm/web -- TerminalHeader
git commit -m "feat(web): simplify Terminal header with Badge + IconButton (Phase 6 G8)"
```

---

## Task G9: Settings リファイン

**Files:**
- Modify: `packages/web/src/components/settings/SettingsPanel.tsx`
- Modify: `packages/web/src/components/settings/AppearanceSection.tsx`
- Modify: `packages/web/src/components/settings/GatewaySection.tsx`
- Modify: `packages/web/src/components/settings/SystemStatusSection.tsx`
- Modify: `packages/web/src/components/settings/RateLimitsSection.tsx`

- [ ] **Step 1: Wrap each section with Card**

```typescript
// SettingsPanel.tsx
import { Card } from '../ui/Card';

return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg, padding: tokens.spacing.lg }}>
    <Card aria-labelledby="settings-appearance"><AppearanceSection /></Card>
    <Card aria-labelledby="settings-terminal"><TerminalSection /></Card>
    <Card aria-labelledby="settings-gateway"><GatewaySection /></Card>
    <Card aria-labelledby="settings-system"><SystemStatusSection /></Card>
    <Card aria-labelledby="settings-rate"><RateLimitsSection /></Card>
  </div>
);
```

各セクション内の section heading に `id="settings-XXX"` を付与。

- [ ] **Step 2: Reorder Gateway CTAs**

```typescript
// GatewaySection.tsx (CTAs 部分)
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
  <button onClick={onCopyUrl} style={primaryOutlineBtn}>Copy Web URL</button>
  <button onClick={onShowQr} style={primaryOutlineBtn}>Show mobile QR</button>
</div>
<button onClick={onReenter} style={secondaryBtn}>Re-enter token</button>
<button onClick={onLogout} style={dangerOutlineBtn}>Sign out</button>
```

`Sign out` は danger outline で目立たせ、最下部に隔離。

- [ ] **Step 3: SystemStatus を 3 列 grid**

```typescript
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: tokens.spacing.md }}>
  <Metric label={t('system.uptime')} value={uptime} />
  <Metric label={t('system.loadAvg')} value={load} />
  <Metric label={t('system.memory')} value={memory} >
    <div style={{ marginTop: tokens.spacing.xs, height: 4, borderRadius: 2, background: tokens.colors.surface, position: 'relative' }}>
      <div style={{ width: `${memPct}%`, height: '100%', background: tokens.colors.primary, borderRadius: 2 }} />
    </div>
  </Metric>
</div>
```

- [ ] **Step 4: RateLimits — "B" バッジ意味付け**

```typescript
// RateLimitsSection.tsx
import { Badge } from '../ui/Badge';

// "B" は "Basic plan" のショート。意味不明問題は Badge + tooltip で解消
<Badge tone="info" icon={<IconInfo size={10} />}>{plan}</Badge>
<Tooltip label={t('rateLimits.planTooltip')}>...</Tooltip>
```

Claude / Codex を tab 切替で grouping (現状は縦並び)。`Setup guide` リンクを primary CTA に。

- [ ] **Step 5: Run tests + commit**

```bash
npm test --workspace=@zenterm/web -- settings
git commit -m "feat(web): Card-based Settings sections + CTA hierarchy (Phase 6 G9)"
```

---

## Task G10: 空状態統一

**Files:**
- Modify: `packages/web/src/components/SessionsListPanel.tsx` (sessions empty を EmptyState 化)
- Modify: `packages/web/src/components/layout/MultiPaneArea.tsx` (pane 未割当 EmptyState)
- Modify: `packages/web/src/components/AuthenticatedShell.tsx` (Main 未選択 EmptyState)
- Create: `tests/e2e/web/phase6-empty-states.spec.ts` (port 18817, TOKEN '4817')

- [ ] **Step 1: Replace each empty area with EmptyState**

```typescript
// SessionsListPanel.tsx empty 部分
import { EmptyState } from './ui/EmptyState';
import { IconTerminal } from './ui/icons';

{!loading && !error && sessions.length === 0 && (
  <EmptyState icon={<IconTerminal size={32} />} title={t('sessions.empty.title')} description={t('sessions.empty.description')} size="sm" />
)}
```

```typescript
// MultiPaneArea.tsx (pane null 時)
{currentPane === null && (
  <EmptyState icon={<IconTerminal size={32} />} title={t('multiPane.empty.title')} description={t('multiPane.empty.description')} />
)}
```

```typescript
// AuthenticatedShell.tsx (Main route の outlet 直下 fallback)
<EmptyState icon={<IconTerminal size={32} />} title={t('shell.empty.title')} description={t('shell.empty.description')} />
```

- [ ] **Step 2: e2e spec**

```typescript
// tests/e2e/web/phase6-empty-states.spec.ts
import { test, expect } from '@playwright/test';
import { setupGateway } from './helpers/gateway';

const PORT = 18817; const TOKEN = '4817';
let gateway: Awaited<ReturnType<typeof setupGateway>>;

test.beforeAll(async () => { gateway = await setupGateway(PORT, TOKEN); });
test.afterAll(async () => { await gateway.stop(); });

test.beforeEach(async ({ page }) => {
  await page.goto(`http://127.0.0.1:${PORT}/web/login`);
  await page.locator('input[aria-label*="Digit 1"]').fill('4');
  await page.locator('input[aria-label*="Digit 2"]').fill('8');
  await page.locator('input[aria-label*="Digit 3"]').fill('1');
  await page.locator('input[aria-label*="Digit 4"]').fill('7');
  await page.getByRole('button', { name: /sign in/i }).click();
});

test('sessions empty state renders icon + title + description', async ({ page }) => {
  // 新規 gateway は空、セッションなし
  await expect(page.getByRole('status').filter({ hasText: /no.*sessions|empty/i })).toBeVisible();
});

test('main empty state visible when no pane selected', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: /select a session/i })).toBeVisible();
});

test('files empty state visible at empty dir', async ({ page }) => {
  await page.getByRole('tab', { name: /files/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /drag files|empty/i })).toBeVisible();
});

test('files viewer empty before selection', async ({ page }) => {
  await page.getByRole('tab', { name: /files/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /no file selected/i })).toBeVisible();
});
```

- [ ] **Step 3: Add i18n keys**

```json
{
  "sessions": { "empty": { "title": "No sessions yet", "description": "Click + to create one" } },
  "multiPane": { "empty": { "title": "Assign a session to this pane", "description": "Right-click a session in the sidebar" } },
  "shell": { "empty": { "title": "Select a session", "description": "Choose one from the sidebar to start" } }
}
```

- [ ] **Step 4: Run + commit**

```bash
npx playwright test --project=web-pc phase6-empty-states 2>&1 | tail -10
git commit -m "feat(web): unify all empty states with EmptyState primitive (Phase 6 G10)"
```

---

## Task H11: Onboarding 3 ステップガイド

**Files:**
- Create: `packages/web/src/components/onboarding/OnboardingGuide.tsx`
- Create: `packages/web/src/components/onboarding/__tests__/OnboardingGuide.test.tsx`
- Modify: `packages/web/src/stores/settings.ts` (`dismissOnboarding: boolean` 追加)
- Modify: `packages/web/src/components/AuthenticatedShell.tsx` (条件付き表示)

- [ ] **Step 1: Test**

```typescript
describe('OnboardingGuide', () => {
  it('renders 3 steps', () => {
    render(w(<OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={() => {}} />));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
  it('marks step 2 done when tokenEntered', () => {
    render(w(<OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={() => {}} />));
    const steps = screen.getAllByRole('listitem');
    expect(steps[1].textContent).toMatch(/✓|done/i);
  });
  it('calls onDismiss when "Don\'t show again" clicked', async () => {
    const handler = vi.fn();
    render(w(<OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={handler} />));
    await userEvent.click(screen.getByRole('button', { name: /don't show again/i }));
    expect(handler).toHaveBeenCalled();
  });
  it('marks step 3 done when sessionsCount > 0', () => {
    render(w(<OnboardingGuide tokenEntered={true} sessionsCount={1} onDismiss={() => {}} />));
    const steps = screen.getAllByRole('listitem');
    expect(steps[2].textContent).toMatch(/✓|done/i);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// packages/web/src/components/onboarding/OnboardingGuide.tsx
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Card } from '../ui/Card';
import { Stepper } from '../ui/Stepper';
import { IconRocket } from '../ui/icons';

export interface OnboardingGuideProps {
  tokenEntered: boolean;
  sessionsCount: number;
  onDismiss: () => void;
}

export function OnboardingGuide({ tokenEntered, sessionsCount, onDismiss }: OnboardingGuideProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const steps = [
    {
      title: t('onboarding.step1.title'),
      description: (
        <code style={{ display: 'inline-block', padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`, background: tokens.colors.surface, borderRadius: tokens.radii.sm, fontFamily: tokens.typography.mono.fontFamily, fontSize: tokens.typography.small.fontSize }}>
          npx zenterm-gateway
        </code>
      ),
      status: 'done' as const,
    },
    {
      title: t('onboarding.step2.title'),
      description: t('onboarding.step2.description'),
      status: (tokenEntered ? 'done' : 'current') as 'done' | 'current',
    },
    {
      title: t('onboarding.step3.title'),
      description: t('onboarding.step3.description'),
      status: (sessionsCount > 0 ? 'done' : tokenEntered ? 'current' : 'pending') as 'done' | 'current' | 'pending',
    },
  ];

  return (
    <Card aria-labelledby="onboarding-title" padding="lg" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md, color: tokens.colors.primary }}>
        <IconRocket size={24} aria-hidden />
        <h3 id="onboarding-title" style={{ margin: 0, fontSize: tokens.typography.heading.fontSize, color: tokens.colors.textPrimary }}>
          {t('onboarding.title')}
        </h3>
      </div>
      <Stepper steps={steps} />
      <button onClick={onDismiss} style={{
        marginTop: tokens.spacing.lg, background: 'transparent', border: 'none',
        color: tokens.colors.textMuted, cursor: 'pointer',
        fontSize: tokens.typography.small.fontSize, textDecoration: 'underline',
      }}>{t('onboarding.dismiss')}</button>
    </Card>
  );
}
```

- [ ] **Step 3: Hook into settings store**

```typescript
// stores/settings.ts に追加
interface SettingsState {
  // 既存
  dismissOnboarding: boolean;
  setDismissOnboarding: (v: boolean) => void;
}

// persist v2 migration: version bump + default false
```

- [ ] **Step 4: Conditional render in AuthenticatedShell**

```typescript
// AuthenticatedShell.tsx
const dismissOnboarding = useSettingsStore((s) => s.dismissOnboarding);
const setDismissOnboarding = useSettingsStore((s) => s.setDismissOnboarding);

// Main エリアで sessions タブ + sessions 0 件 + !dismissOnboarding なら OnboardingGuide
{activeTab === 'sessions' && sessions.length === 0 && !dismissOnboarding && (
  <OnboardingGuide tokenEntered={true} sessionsCount={0} onDismiss={() => setDismissOnboarding(true)} />
)}
```

- [ ] **Step 5: i18n keys (8 言語)**

```json
{
  "onboarding": {
    "title": "Get started",
    "step1": { "title": "Start the Gateway" },
    "step2": { "title": "Enter your token", "description": "Token shown by the gateway on first launch." },
    "step3": { "title": "Create a session", "description": "Click + New Session to spin up tmux." },
    "dismiss": "Don't show again"
  }
}
```

- [ ] **Step 6: Run + commit**

```bash
npm test --workspace=@zenterm/web -- Onboarding
git commit -m "feat(web): add 3-step onboarding guide for first-run users (Phase 6 H11)"
```

---

## Task H12: トランジション + スケルトン

**Files:**
- Modify: `packages/web/src/index.css` (transition rules)
- Modify: `packages/web/src/components/AuthenticatedShell.tsx` (tab fade)
- Modify: `packages/web/src/components/SessionsListPanel.tsx` (Skeleton loading)
- Modify: `packages/web/src/components/files/FilesList.tsx` (Skeleton loading)

- [ ] **Step 1: Global transition rules**

```css
/* packages/web/src/index.css */
.zen-fade { transition: opacity 150ms ease-out; }
.zen-fade-leave { opacity: 0; }
.zen-fade-enter { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .zen-fade { transition: none; }
}
```

- [ ] **Step 2: Tab fade in AuthenticatedShell**

`activeTab` 切替時に key prop で remount + `className="zen-fade"`。

- [ ] **Step 3: Skeleton loading**

```typescript
// SessionsListPanel.tsx loading 部分を置換
import { Skeleton } from './ui/Skeleton';

{loading && sessions.length === 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ display: 'flex', gap: tokens.spacing.md, padding: tokens.spacing.md }}>
        <Skeleton width={8} height={8} radius={4} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="80%" height={12} />
        </div>
      </div>
    ))}
  </div>
)}
```

FilesList も同様。

- [ ] **Step 4: Add reduced-motion e2e**

`tests/e2e/web/phase6-empty-states.spec.ts` または別 spec で reduced motion 確認:

```typescript
test('reduced motion disables transitions', async ({ page, context }) => {
  await context.emulateMedia({ reducedMotion: 'reduce' });
  // tab 切替で transition が発火しないことを computed style で確認
});
```

- [ ] **Step 5: Run + commit**

```bash
git commit -m "feat(web): add tab fade + Skeleton loading (Phase 6 H12)"
```

---

## Task H13: Focus ring + Tooltip 統一

**Files:**
- Modify: `packages/web/src/index.css` (global focus-visible rule)
- Modify: 各 interactive 要素 (button, input, select) — 個別 style から global rule に依存
- Create: `tests/manual/keyboard-tour.md`

- [ ] **Step 1: Global focus ring**

```css
/* packages/web/src/index.css */
:focus-visible {
  outline: 2px solid var(--zen-focus-ring, #B6C8A4);
  outline-offset: 2px;
  border-radius: 2px;
}
button:focus-visible, a:focus-visible, [role="tab"]:focus-visible, [role="menuitem"]:focus-visible {
  outline-color: var(--zen-focus-ring, #B6C8A4);
}
```

ThemeProvider で `<html>` に `style="--zen-focus-ring: ..."` を inject:

```typescript
// theme/index.tsx
useEffect(() => {
  document.documentElement.style.setProperty('--zen-focus-ring', tokens.colors.focusRing);
}, [tokens]);
```

- [ ] **Step 2: 個別 outline 削除**

各コンポーネントの `outline: 'none'` を削除 (focus-visible 経由でグローバル制御)。

- [ ] **Step 3: 手動チェックリスト**

```markdown
# Phase 6 キーボードツアー手動チェックリスト

## 目的
全主要画面で Tab / Shift+Tab / Arrow / Enter / Esc が期待どおり動くこと、focus ring が常に視認できることを確認。

## チェック
- [ ] Login: Tab で OTP[0]→[1]→[2]→[3]→Sign in
- [ ] LeftRail: ArrowUp/Down で Sessions/Files/Settings 切替、Enter で activate
- [ ] Sessions: Tab で各 SessionRow、Enter で開く、F2 で rename
- [ ] Files: Tab で Toolbar→Breadcrumb→FilesItem→Viewer
- [ ] Terminal: Tab で header controls
- [ ] Settings: Tab で各 Card 内 control
- [ ] 全 focus ring が visible (focus-visible 経由)
- [ ] Esc で全 modal/menu 閉じる
```

- [ ] **Step 4: Run + commit**

```bash
git commit -m "feat(web): global :focus-visible ring + keyboard tour checklist (Phase 6 H13)"
```

---

## 最終確認 / マージ手順

各タスク完了後、最後に:

- [ ] **Run all unit + e2e**

```bash
npm test 2>&1 | tail -30
npx playwright test --project=web-pc 2>&1 | tail -30
npx tsc --noEmit
```

- [ ] **Build bundle and verify size**

```bash
npm run build --workspace=@zenterm/web
ls -la packages/web/dist/assets/*.js
```
gzip サイズ増加が Phase 5b 比 +30KB 以内であること。

- [ ] **Refresh screenshots**

```bash
npx playwright test tests/manual/screenshot.spec.ts --project=web-pc
ls -la docs/screenshots/web-pc-*.png
```

5 枚 (login, sessions, files, settings, multi-pane) を最新の UI で再撮影。

- [ ] **Update docs/roadmap.md / docs/changelog-phase6.md / README**

Phase 6 完了を追記。

- [ ] **Apply superpowers:finishing-a-development-branch**

main へマージ + tag `web-pc-phase-6-done` + push origin。手順は Phase 5b と同じ。

---

## 想定リスクと対応

| リスク | 検知 | 対応 |
|---|---|---|
| G5 LeftRail 構造変更で広範な e2e selector 破損 | Playwright 実行時の selector miss | Phase 6 plan の Step 5 (G5) で既存 e2e selector を `role="tab"` ベースに一括更新 |
| lucide-react で SSR 不整合 | `npm run build` で警告 | Vite 構成は CSR のみなので影響なし。確認のみ |
| Settings 内 Card 化で SystemStatus grid が iPad で潰れる | tests/manual/ipad-regression.md 一巡 | 480px 以下で `grid-template-columns: 1fr` にフォールバック |
| OTP マスで iOS Safari の autofill / IME 干渉 | 手動確認 | autocomplete="one-time-code" + inputMode="numeric" 付与済 |
| onboarding が一度 dismiss されたら再表示できない | UX クレーム | Settings に "Reset onboarding" ボタンを追加 (G9 のついで) |

---

## ファイル参照早見表

| Task | 主 modify ファイル | 新規 ファイル |
|---|---|---|
| F1 tokens | `theme/tokens.ts` | `theme/__tests__/tokens.test.ts` |
| F2 primitives | — | `ui/{Card,EmptyState,Stepper,Spinner,Skeleton,Badge,IconButton}.tsx` + tests |
| F3 icons | `package.json` | `ui/icons/index.ts` |
| G4 Login | `LoginForm.tsx` | `login/OtpInput.tsx` |
| G5 LeftRail | `AuthenticatedShell.tsx` | `LeftRail.tsx` |
| G6 Sessions | `SessionsListPanel.tsx`, `sidebar/SessionRow.tsx` | — |
| G7 Files | `files/FilesToolbar.tsx`, `FilesBreadcrumbs.tsx`, `FilesItem.tsx`, `FilesList.tsx`, `FilesViewerEmpty.tsx` | — |
| G8 Terminal | `terminal/TerminalHeader.tsx` | — |
| G9 Settings | `settings/*` | — |
| G10 Empty | 上記各画面 | `tests/e2e/web/phase6-empty-states.spec.ts` |
| H11 Onboarding | `AuthenticatedShell.tsx`, `stores/settings.ts` | `onboarding/OnboardingGuide.tsx` |
| H12 Transition | `index.css`, `AuthenticatedShell.tsx`, `SessionsListPanel.tsx`, `files/FilesList.tsx` | — |
| H13 Focus | `index.css`, `theme/index.tsx` | `tests/manual/keyboard-tour.md` |
