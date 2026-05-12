import { useTranslation } from 'react-i18next';
import { useSettingsStore, type Language, type ThemeMode } from '@/stores/settings';
import { useTheme } from '@/theme';

const THEME_OPTIONS: { value: ThemeMode; key: string; defaultLabel: string }[] = [
  { value: 'light', key: 'settings.appearance.themeOptions.light', defaultLabel: 'Light' },
  { value: 'dark', key: 'settings.appearance.themeOptions.dark', defaultLabel: 'Dark' },
  { value: 'system', key: 'settings.appearance.themeOptions.system', defaultLabel: 'System' },
];

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'ko', label: '한국어' },
];

export function AppearanceSection() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <section
      role="region"
      aria-label="Appearance"
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
        {t('settings.appearance.title', 'Appearance')}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0` }}>
        <span style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}>
          {t('settings.appearance.theme', 'Theme')}
        </span>
        <div style={{ display: 'flex', gap: tokens.spacing.xs }}>
          {THEME_OPTIONS.map((opt) => {
            const active = opt.value === themeMode;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setThemeMode(opt.value)}
                style={{
                  padding: `4px 10px`,
                  borderRadius: tokens.radii.sm,
                  border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
                  background: active ? tokens.colors.primary : 'transparent',
                  color: active ? tokens.colors.textInverse : tokens.colors.textSecondary,
                  fontSize: tokens.typography.caption.fontSize,
                  cursor: 'pointer',
                }}
              >
                {t(opt.key, opt.defaultLabel)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0` }}>
        <label
          htmlFor="settings-language"
          style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}
        >
          {t('settings.appearance.language', 'Language')}
        </label>
        <select
          id="settings-language"
          aria-label={t('settings.appearance.language', 'Language')}
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{
            background: tokens.colors.surface,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            padding: `4px 6px`,
            borderRadius: tokens.radii.sm,
            fontSize: tokens.typography.small.fontSize,
          }}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
