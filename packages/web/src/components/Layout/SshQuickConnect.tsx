import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useSshPresetsStore,
  validateSshPreset,
  buildSshCommand,
  type SshPreset,
} from '../../stores/ssh';
import { useSessionsStore } from '../../stores/sessions';
import styles from './SshQuickConnect.module.css';

interface SshQuickConnectProps {
  onConnected?: () => void;
}

export function SshQuickConnect({ onConnected }: SshQuickConnectProps) {
  const { t } = useTranslation();
  const presets = useSshPresetsStore((s) => s.presets);
  const addPreset = useSshPresetsStore((s) => s.addPreset);
  const removePreset = useSshPresetsStore((s) => s.removePreset);
  const createSession = useSessionsStore((s) => s.createSession);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [user, setUser] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (preset: SshPreset) => {
    setConnecting(true);
    setError('');
    try {
      const session = await createSession(`ssh-${preset.label || preset.host}`);
      // Send SSH command to the new session via WebSocket
      // The terminal will be opened and the command sent after a short delay
      setTimeout(() => {
        const cmd = buildSshCommand(preset) + '\n';
        const wsUrl = new URL(
          `/api/terminal?sessionId=${encodeURIComponent(session.name)}`,
          window.location.href
        );
        // The command will be sent via the terminal's WebSocket
        // Store it temporarily so the terminal can pick it up
        sessionStorage.setItem(`zenterm_ssh_cmd_${session.name}`, cmd);
      }, 100);
      onConnected?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleAddPreset = () => {
    const validationError = validateSshPreset({ host, user, port });
    if (validationError) {
      setError(validationError);
      return;
    }
    addPreset({ label: label || host, host, port, user });
    setLabel('');
    setHost('');
    setPort(22);
    setUser('');
    setShowForm(false);
    setError('');
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t('ssh.title')}</span>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕' : '+'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {showForm && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder={t('ssh.label')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder={t('ssh.host')}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            required
          />
          <div className={styles.row}>
            <input
              className={styles.input}
              placeholder={t('ssh.user')}
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
            />
            <input
              className={styles.inputSmall}
              type="number"
              placeholder={t('ssh.port')}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              min={1}
              max={65535}
            />
          </div>
          <button className={styles.saveBtn} onClick={handleAddPreset}>
            {t('ssh.save')}
          </button>
        </div>
      )}

      <div className={styles.list}>
        {presets.length === 0 && !showForm && (
          <div className={styles.empty}>{t('ssh.noPresets')}</div>
        )}
        {presets.map((preset) => (
          <div key={preset.id} className={styles.item}>
            <button
              className={styles.connectBtn}
              onClick={() => handleConnect(preset)}
              disabled={connecting}
            >
              <span className={styles.presetLabel}>{preset.label}</span>
              <span className={styles.presetHost}>
                {preset.user}@{preset.host}
                {preset.port !== 22 ? `:${preset.port}` : ''}
              </span>
            </button>
            <button
              className={styles.removeBtn}
              onClick={() => removePreset(preset.id)}
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
