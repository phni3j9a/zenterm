import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { verifyAuth } from '../api/client';
import styles from './LoginPage.module.css';

const AUTH_STORAGE_KEY = 'zenterm_auth';

export function LoginPage() {
  const [token, setToken] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = gatewayUrl.trim().replace(/\/+$/, '');
    const nextToken = token.trim();
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: nextToken, gatewayUrl: url }),
    );

    try {
      await verifyAuth();
      setAuth(nextToken, url);
      navigate('/', { replace: true });
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setError('Authentication failed. Check your token and server URL.');
    } finally {
      setLoading(false);
    }
  };

  const needsUrl = !window.location.hostname.includes('localhost') || window.location.port !== '5173';
  const showUrlField = needsUrl || gatewayUrl;

  return (
    <div className={styles.page} data-testid="login-page">
      <div className={styles.card}>
        <div className={styles.logoSection}>
          <div className={styles.logoMark}>Z</div>
          <h1 className={styles.title}>ZenTerm</h1>
          <p className={styles.subtitle}>Terminal Gateway</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {showUrlField && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="gatewayUrl">
                Gateway URL
              </label>
              <input
                id="gatewayUrl"
                className={styles.input}
                type="text"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="http://raspberrypi:18765"
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="token">
              Token
            </label>
            <input
              id="token"
              className={styles.input}
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter access token"
              autoFocus
            />
          </div>

          {error && (
            <p className={styles.error} data-testid="login-error">
              {error}
            </p>
          )}

          <button
            className={styles.submitBtn}
            type="submit"
            disabled={!token.trim() || loading}
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
