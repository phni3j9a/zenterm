import { useTranslation } from 'react-i18next';
import { useSettingsStore, MIN_FONT_SIZE, MAX_FONT_SIZE } from '@/stores/settings';
import { useTheme } from '@/theme';

export function TerminalSection() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);

  const stepBtn = (disabled: boolean) => ({
    background: tokens.colors.surface,
    border: `1px solid ${tokens.colors.border}`,
    color: tokens.colors.textPrimary,
    width: 28,
    height: 28,
    borderRadius: tokens.radii.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <section
      role="region"
      aria-label="Terminal"
      style={{
        marginTop: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <h3
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: tokens.typography.caption.fontSize,
          color: tokens.colors.textMuted,
          margin: `0 0 ${tokens.spacing.sm}px 0`,
        }}
      >
        {t('settings.terminal.title', 'Terminal')}
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0` }}>
        <span style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}>
          {t('settings.terminal.fontSize', 'Font size')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
          <button
            type="button"
            aria-label="Decrease font size"
            disabled={fontSize <= MIN_FONT_SIZE}
            onClick={() => setFontSize(fontSize - 1)}
            style={stepBtn(fontSize <= MIN_FONT_SIZE)}
          >
            −
          </button>
          <span style={{ minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: tokens.colors.textPrimary }}>
            {fontSize}
          </span>
          <button
            type="button"
            aria-label="Increase font size"
            disabled={fontSize >= MAX_FONT_SIZE}
            onClick={() => setFontSize(fontSize + 1)}
            style={stepBtn(fontSize >= MAX_FONT_SIZE)}
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}
