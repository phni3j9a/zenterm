import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getScrollback } from '../../api/client';
import { useSessionsStore } from '../../stores/sessions';
import styles from './ScrollbackPanel.module.css';

export function ScrollbackPanel() {
  const { t } = useTranslation();
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchScrollback = () => {
    if (!activeSessionId) return;
    setLoading(true);
    setError('');
    getScrollback(activeSessionId)
      .then((res) => setContent(res.content))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchScrollback();
  }, [activeSessionId]);

  if (!activeSessionId) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>{t('scrollback.noSession')}</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t('scrollback.title')}</span>
        <button className={styles.refreshBtn} onClick={fetchScrollback} disabled={loading}>
          ↻
        </button>
      </div>
      <div className={styles.body}>
        {loading && <div className={styles.message}>Loading...</div>}
        {error && <div className={styles.error}>{error}</div>}
        {!loading && !error && (
          <pre className={styles.content}>{content}</pre>
        )}
      </div>
    </div>
  );
}
