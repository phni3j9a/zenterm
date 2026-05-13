import type { TmuxSession } from '@zenterm/shared';
import type { LayoutMode } from './paneLayout';
import type { ThemeMode } from '@/stores/settings';

export interface PaletteAction {
  id: string;
  label: string;
  keywords?: string;
  run: () => void;
}

interface BuildArgs {
  sessions: TmuxSession[];
  navigate: (path: string) => void;
  paneActions: {
    setLayout: (mode: LayoutMode) => void;
  };
  settingsActions: {
    setThemeMode: (m: ThemeMode) => void;
  };
  sessionsActions: {
    createSession: () => void;
  };
}

const LAYOUTS: { mode: LayoutMode; label: string }[] = [
  { mode: 'single', label: 'Single' },
  { mode: 'cols-2', label: '2 columns' },
  { mode: 'cols-3', label: '3 columns' },
  { mode: 'grid-2x2', label: '2x2 grid' },
];

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: 'dark', label: 'Dark' },
  { mode: 'light', label: 'Light' },
  { mode: 'system', label: 'System' },
];

export function buildCommandPaletteActions(args: BuildArgs): PaletteAction[] {
  const out: PaletteAction[] = [];

  out.push({
    id: 'action:create-session',
    label: 'Create new session',
    keywords: 'new tmux',
    run: () => args.sessionsActions.createSession(),
  });

  for (const l of LAYOUTS) {
    out.push({
      id: `action:layout:${l.mode}`,
      label: `Layout: ${l.label}`,
      keywords: 'split pane',
      run: () => args.paneActions.setLayout(l.mode),
    });
  }
  for (const t of THEMES) {
    out.push({
      id: `action:theme:${t.mode}`,
      label: `Theme: ${t.label}`,
      keywords: 'color',
      run: () => args.settingsActions.setThemeMode(t.mode),
    });
  }
  out.push({ id: 'action:nav:settings', label: 'Open settings', run: () => args.navigate('/web/settings') });
  out.push({ id: 'action:nav:files', label: 'Open files', run: () => args.navigate('/web/files') });
  out.push({ id: 'action:nav:sessions', label: 'Open sessions', run: () => args.navigate('/web/sessions') });

  for (const s of args.sessions) {
    for (const w of s.windows ?? []) {
      out.push({
        id: `jump:${s.displayName}:${w.index}`,
        label: `Open ${s.displayName} / ${w.name}`,
        keywords: `session window ${s.displayName}`,
        run: () => {
          // Concrete jump action is overridden by the palette consumer.
          // Default falls back to navigating to /web/sessions.
          args.navigate(`/web/sessions`);
        },
      });
    }
  }
  return out;
}
