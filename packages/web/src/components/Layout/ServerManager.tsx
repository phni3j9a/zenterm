import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServersStore, type ServerProfile } from '../../stores/servers';
import { useSessionsStore } from '../../stores/sessions';
import styles from './ServerManager.module.css';

export function ServerManager() {
  const { t } = useTranslation();
  const profiles = useServersStore((s) => s.profiles);
  const activeServerId = useServersStore((s) => s.activeServerId);
  const addServer = useServersStore((s) => s.addServer);
  const removeServer = useServersStore((s) => s.removeServer);
  const switchServer = useServersStore((s) => s.switchServer);
  const fetchSessions = useSessionsStore((s) => s.fetchSessions);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!url.trim()) {
      setError(t('servers.urlRequired'));
      return;
    }
    if (!token.trim()) {
      setError(t('servers.tokenRequired'));
      return;
    }
    try {
      new URL(url);
    } catch {
      setError(t('servers.invalidUrl'));
      return;
    }
    addServer(label || new URL(url).hostname, url.trim(), token.trim());
    setLabel('');
    setUrl('');
    setToken('');
    setShowForm(false);
    setError('');
  };

  const handleSwitch = async (profile: ServerProfile) => {
    if (profile.id === activeServerId) return;
    switchServer(profile.id);
    // Clear current sessions and reload from new server
    useSessionsStore.setState({ sessions: [], openTabs: [], activeSessionId: null });
    await fetchSessions();
  };

  const handleRemove = (id: string) => {
    removeServer(id);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t('servers.title')}</span>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕' : '+'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {showForm && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder={t('servers.label')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder={t('servers.url')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <input
            className={styles.input}
            type="password"
            placeholder={t('servers.token')}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <button className={styles.saveBtn} onClick={handleAdd}>
            {t('servers.add')}
          </button>
        </div>
      )}

      <div className={styles.list}>
        {profiles.length === 0 && !showForm && (
          <div className={styles.empty}>{t('servers.noServers')}</div>
        )}
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={styles.item}
            data-active={profile.id === activeServerId}
          >
            <button
              className={styles.connectBtn}
              onClick={() => handleSwitch(profile)}
            >
              <div className={styles.indicator} data-active={profile.id === activeServerId} />
              <div className={styles.info}>
                <span className={styles.profileLabel}>{profile.label}</span>
                <span className={styles.profileUrl}>{profile.url || t('servers.local')}</span>
              </div>
            </button>
            <button
              className={styles.removeBtn}
              onClick={() => handleRemove(profile.id)}
              title={t('common.delete')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
