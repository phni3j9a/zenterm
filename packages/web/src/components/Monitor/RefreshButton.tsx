import { useTranslation } from 'react-i18next';
import styles from './RefreshButton.module.css';

interface Props {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function RefreshButton({ onClick, loading, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={t('common.refresh')}
    >
      <svg
        className={loading ? styles.spinning : undefined}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  );
}
