import { useTranslation } from 'react-i18next';
import { useSettingsStore, MIN_FONT_SIZE, MAX_FONT_SIZE } from '@/stores/settings';
import { useTheme } from '@/theme';

interface TerminalSectionProps {
  headingId?: string;
}

export function TerminalSection({ headingId }: TerminalSectionProps = {}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const autoCopyOnSelect = useSettingsStore((s) => s.autoCopyOnSelect);
  const setAutoCopyOnSelect = useSettingsStore((s) => s.setAutoCopyOnSelect);

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
    <section>
      <h3
        id={headingId}
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

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0`, gap: tokens.spacing.md }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}>
            {t('settings.terminal.autoCopyOnSelect', 'Auto-copy selection')}
          </div>
          <div style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.xs }}>
            {t('settings.terminal.autoCopyOnSelectDesc', 'Copy selected text to the clipboard automatically.')}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoCopyOnSelect}
          aria-label={t('settings.terminal.autoCopyOnSelect', 'Auto-copy selection')}
          onClick={() => setAutoCopyOnSelect(!autoCopyOnSelect)}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: `1px solid ${tokens.colors.border}`,
            background: autoCopyOnSelect ? tokens.colors.primary : tokens.colors.surface,
            position: 'relative',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: tokens.colors.bgElevated,
              position: 'absolute',
              top: 2,
              left: autoCopyOnSelect ? 18 : 2,
              transition: 'left 120ms',
            }}
          />
        </button>
      </div>
    </section>
  );
}
