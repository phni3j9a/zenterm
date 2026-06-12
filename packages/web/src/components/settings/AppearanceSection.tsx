import { useTranslation } from 'react-i18next';
import { useSettingsStore, type Language, type ThemeMode, LANGUAGE_LABELS } from '@/stores/settings';
import { useTheme } from '@/theme';

const THEME_OPTIONS: { value: ThemeMode; key: string; defaultLabel: string }[] = [
  { value: 'light', key: 'settings.appearance.themeOptions.light', defaultLabel: 'Light' },
  { value: 'dark', key: 'settings.appearance.themeOptions.dark', defaultLabel: 'Dark' },
  { value: 'system', key: 'settings.appearance.themeOptions.system', defaultLabel: 'System' },
];

const LANGUAGE_ORDER: Language[] = ['ja', 'en', 'es', 'fr', 'de', 'pt-BR', 'zh-CN', 'ko'];
const LANGUAGE_OPTIONS = LANGUAGE_ORDER.map((value) => ({ value, label: LANGUAGE_LABELS[value] }));

interface AppearanceSectionProps {
  headingId?: string;
}

export function AppearanceSection({ headingId }: AppearanceSectionProps = {}) {
  const { tokens, resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const dark = resolvedTheme === 'dark';

  return (
    <section>
      <h3
        id={headingId}
        style={{
          ...tokens.typography.overline,
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
        {/* iOS 設定と同じセグメントコントロール: 沈んだトラックの上で
            選択中セグメントだけがカード面の色で浮かぶ */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 2,
            borderRadius: tokens.radii.sm,
            background: dark ? tokens.colors.bg : tokens.colors.surface,
          }}
        >
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
                  borderRadius: tokens.radii.sm - 2,
                  border: 'none',
                  background: active
                    ? dark
                      ? tokens.colors.surfaceHover
                      : tokens.colors.bgElevated
                    : 'transparent',
                  color: active ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                  fontWeight: active ? 600 : 400,
                  fontSize: tokens.typography.caption.fontSize,
                  cursor: 'pointer',
                  boxShadow: active ? tokens.shadows.sm : 'none',
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
            background: dark ? tokens.colors.surfaceHover : tokens.colors.surface,
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
