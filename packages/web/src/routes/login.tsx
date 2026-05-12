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
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
      }}
    >
      <LoginForm onSubmit={handleSubmit} gatewayUrl={gatewayUrl} />
    </div>
  );
}
