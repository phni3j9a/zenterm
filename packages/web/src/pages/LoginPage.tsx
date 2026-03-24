import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { verifyAuth } from '../api/client';
import styles from './LoginPage.module.css';

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

    // Temporarily store for verifyAuth to pick up
    const url = gatewayUrl.trim().replace(/\/+$/, '');
    setAuth(token.trim(), url);

    try {
      await verifyAuth();
      navigate('/', { replace: true });
    } catch {
      setError('Authentication failed. Check your token and server URL.');
      setAuth('', url); // Clear invalid token but keep URL
    } finally {
      setLoading(false);
    }
  };

  const needsUrl = !window.location.hostname.includes('localhost') || window.location.port !== '5173';
  const showUrlField = needsUrl || gatewayUrl;

  return (
    <div className={styles.page}>
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

          {error && <p className={styles.error}>{error}</p>}

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
