import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/LoginForm';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';

export function LoginRoute() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { tokens } = useTheme();

  const gatewayUrl = window.location.origin;

  const handleSubmit = async (token: string) => {
    const client = new ApiClient(gatewayUrl, token);
    const ok = await client.verifyToken();
    if (!ok) {
      throw new Error('Token が違います。Gateway 起動時に表示された 4 桁を入力してください。');
    }
    login(token, gatewayUrl);
    navigate('/web/sessions', { replace: true });
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
