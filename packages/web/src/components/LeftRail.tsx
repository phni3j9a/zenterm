import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Tooltip } from '@/components/ui/Tooltip';
import { EventsStatusDot } from '@/components/Sidebar';
import {
  IconTerminal,
  IconFolder,
  IconSettings,
  IconLogout,
} from '@/components/ui/icons';

export type ShellTab = 'sessions' | 'files' | 'settings';

export interface LeftRailProps {
  activeTab: ShellTab;
  onSelectTab: (tab: ShellTab) => void;
  onLogout: () => void;
  rateLimitsWarning: boolean;
}

const TABS: { id: ShellTab; Icon: React.ElementType; labelKey: string; fallback: string }[] = [
  { id: 'sessions', Icon: IconTerminal, labelKey: 'shell.tabs.sessions', fallback: 'Sessions' },
  { id: 'files', Icon: IconFolder, labelKey: 'shell.tabs.files', fallback: 'Files' },
  { id: 'settings', Icon: IconSettings, labelKey: 'shell.tabs.settings', fallback: 'Settings' },
];

export function LeftRail({ activeTab, onSelectTab, onLogout, rateLimitsWarning }: LeftRailProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % TABS.length;
      tabRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + TABS.length) % TABS.length;
      tabRefs.current[prev]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectTab(TABS[index].id);
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={t('shell.leftRail.label', 'Primary navigation')}
      style={{
        width: 64,
        flexShrink: 0,
        background: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100vh',
        boxSizing: 'border-box',
        paddingTop: tokens.spacing.sm,
        paddingBottom: tokens.spacing.sm,
      }}
    >
      {TABS.map(({ id, Icon, labelKey, fallback }, index) => {
        const isActive = activeTab === id;
        const isSettings = id === 'settings';
        const label = t(labelKey, fallback);
        return (
          <Tooltip key={id} label={label} placement="bottom">
            <button
              ref={(el) => { tabRefs.current[index] = el; }}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: tokens.radii.md,
                border: 'none',
                cursor: 'pointer',
                background: isActive ? tokens.colors.primarySubtle : 'transparent',
                color: isActive ? tokens.colors.primary : tokens.colors.textMuted,
                marginBottom: tokens.spacing.xs,
              }}
            >
              <Icon size={20} />
              {isSettings && rateLimitsWarning && (
                <span
                  aria-label={t('shell.leftRail.rateLimitsWarning', 'Rate limits warning')}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: tokens.colors.warning,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </button>
          </Tooltip>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Events status dot — positioned relative so the absolute child renders inside */}
      <div style={{ position: 'relative', width: 44, height: 20, marginBottom: tokens.spacing.xs }}>
        <EventsStatusDot />
      </div>

      {/* Logout */}
      <Tooltip label={t('shell.tabs.logout', 'Logout')} placement="bottom">
        <button
          type="button"
          aria-label={t('shell.tabs.logout', 'Logout')}
          onClick={onLogout}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: tokens.radii.md,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: tokens.colors.textMuted,
          }}
        >
          <IconLogout size={20} />
        </button>
      </Tooltip>
    </div>
  );
}
