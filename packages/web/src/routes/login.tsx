import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '@/components/LoginForm';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';

interface LocationStateFrom {
  pathname?: string;
  search?: string;
  hash?: string;
}

/** 枯山水の砂紋 + 禅円。装飾専用レイヤー (aria-hidden, pointer-events: none)。 */
function ZenGardenBackdrop() {
  const { tokens, resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const inkSoft = dark ? 'rgba(166, 186, 152, 0.10)' : 'rgba(92, 113, 80, 0.12)';
  const inkFaint = dark ? 'rgba(166, 186, 152, 0.05)' : 'rgba(92, 113, 80, 0.06)';
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* 禅円 (enso) — 一筆の円。conic-gradient で筆の「切れ」を残す */}
      <div
        style={{
          position: 'absolute',
          top: '-18vmin',
          right: '-12vmin',
          width: '62vmin',
          height: '62vmin',
          borderRadius: '50%',
          background: `conic-gradient(from 210deg, transparent 0deg, ${inkSoft} 40deg, ${inkSoft} 290deg, transparent 320deg)`,
          WebkitMask: 'radial-gradient(closest-side, transparent calc(100% - 2.6vmin), #000 calc(100% - 2.4vmin))',
          mask: 'radial-gradient(closest-side, transparent calc(100% - 2.6vmin), #000 calc(100% - 2.4vmin))',
          animation: 'zen-drift 240s linear infinite',
        }}
      />
      {/* 砂紋 — 左下から広がる同心円。石庭の熊手の跡 */}
      <div
        style={{
          position: 'absolute',
          bottom: '-46vmin',
          left: '-30vmin',
          width: '110vmin',
          height: '110vmin',
          borderRadius: '50%',
          background: `repeating-radial-gradient(circle at center, transparent 0px, transparent 34px, ${inkFaint} 34px, ${inkFaint} 36px)`,
        }}
      />
      {/* 上からの和紙の光 — bg より一段明るい簡素なグラデーション */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: dark
            ? 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(228, 224, 212, 0.05), transparent)'
            : 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(252, 251, 248, 0.9), transparent)',
        }}
      />
      {/* 縦書きの銘 — 右端に小さく */}
      <span
        className="zen-display"
        style={{
          position: 'absolute',
          top: '50%',
          right: tokens.spacing['2xl'],
          transform: 'translateY(-50%)',
          writingMode: 'vertical-rl',
          fontSize: 13,
          letterSpacing: '0.6em',
          color: tokens.colors.textMuted,
          opacity: 0.55,
          userSelect: 'none',
        }}
      >
        静寂の中の操作
      </span>
    </div>
  );
}

export function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const { tokens } = useTheme();

  const gatewayUrl = window.location.origin;

  const handleSubmit = async (token: string) => {
    const client = new ApiClient(gatewayUrl, token);
    const ok = await client.verifyToken();
    if (!ok) {
      throw new Error(t('login.invalid'));
    }
    login(token, gatewayUrl);
    const from = (location.state as { from?: LocationStateFrom } | null)?.from;
    let target = '/web/sessions';
    if (from?.pathname && from.pathname !== '/web/login') {
      target = `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
    }
    navigate(target, { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <ZenGardenBackdrop />
      <div className="zen-ink-in" style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
        <LoginForm onSubmit={handleSubmit} gatewayUrl={gatewayUrl} />
      </div>
      <footer
        className="zen-rise"
        style={{
          position: 'relative',
          marginTop: tokens.spacing['2xl'],
          fontSize: tokens.typography.caption.fontSize,
          color: tokens.colors.textMuted,
          letterSpacing: '0.08em',
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          animationDelay: '300ms',
        }}
      >
        <span className="zen-display">ZenTerm</span>
        <span aria-hidden style={{ opacity: 0.5 }}>・</span>
        <span>{t('login.footer', 'tmux をどこからでも、静かに。')}</span>
      </footer>
    </div>
  );
}
