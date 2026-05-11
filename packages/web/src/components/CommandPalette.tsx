import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { useLayoutStore } from '@/stores/layout';
import { useSessionsStore } from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { usePaneStore } from '@/stores/pane';
import { buildCommandPaletteActions, type PaletteAction } from '@/lib/commandPaletteActions';

export function CommandPalette() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const open = useLayoutStore((s) => s.paletteOpen);
  const closePalette = useLayoutStore((s) => s.closePalette);
  const navigate = useNavigate();
  const sessionsRaw = useSessionsStore((s) => s.sessions);
  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : [];

  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlight(0);
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  const actions = useMemo<PaletteAction[]>(() => {
    const built = buildCommandPaletteActions({
      sessions,
      navigate,
      paneActions: { setLayout: (m) => usePaneStore.getState().setLayout(m) },
      settingsActions: { setThemeMode: (m) => useSettingsStore.getState().setThemeMode(m) },
      sessionsActions: {
        createSession: () => {
          // Caller-side fallback — palette navigates to sessions tab.
          navigate('/web/sessions');
        },
      },
    });
    // Override "jump:" actions to actually open the target in the focused pane.
    return built.map((a) => {
      if (!a.id.startsWith('jump:')) return a;
      const rest = a.id.slice('jump:'.length);
      const sep = rest.lastIndexOf(':');
      const sessionId = rest.slice(0, sep);
      const windowIndex = Number(rest.slice(sep + 1));
      return {
        ...a,
        run: () => {
          usePaneStore.getState().openInFocusedPane({ sessionId, windowIndex });
        },
      };
    });
  }, [sessions, navigate]);

  const filtered = useMemo<PaletteAction[]>(() => {
    if (!query.trim()) return actions;
    const fuse = new Fuse(actions, {
      keys: ['label', 'keywords'],
      threshold: 0.5,
      ignoreLocation: true,
    });
    return fuse.search(query).map((r) => r.item);
  }, [actions, query]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  if (!open) return null;

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closePalette();
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const target = filtered[highlight];
      if (!target) return;
      target.run();
      closePalette();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('palette.title')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 200,
      }}
    >
      <div
        style={{
          width: 'min(640px, 90vw)',
          background: tokens.colors.bgElevated,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radii.md,
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-listbox"
          aria-autocomplete="list"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
            color: tokens.colors.textPrimary,
            padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
            fontSize: tokens.typography.bodyMedium.fontSize,
            outline: 'none',
          }}
        />
        <ul
          id="palette-listbox"
          role="listbox"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            overflow: 'auto',
          }}
        >
          {filtered.map((a, i) => {
            const active = i === highlight;
            return (
              <li
                key={a.id}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  a.run();
                  closePalette();
                }}
                style={{
                  padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
                  background: active ? tokens.colors.surfaceHover : 'transparent',
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: tokens.typography.smallMedium.fontSize,
                }}
              >
                {a.label}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li
              role="option"
              aria-selected={false}
              style={{
                padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
                color: tokens.colors.textMuted,
                fontSize: tokens.typography.caption.fontSize,
              }}
            >
              {t('palette.noResults')}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
