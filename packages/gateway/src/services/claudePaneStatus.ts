import type { ClaudeActivity, ClaudeWindowStatus } from '@zenterm/shared';

// 点字ブロック（スピナーのコマ）。先頭がこの範囲 → 作業中。
const BRAILLE_MIN = 0x2800;
const BRAILLE_MAX = 0x28ff;
// 入力待ちを示す静止グリフ。将来の仕様変更時はここに追記する。
const WAITING_GLYPHS = new Set(['✳']); // U+2733 EIGHT SPOKED ASTERISK
// claude 在席とみなすフォアグラウンドコマンド。
// 'node' は既知グリフを持つ場合のみ在席扱い（無関係な node アプリの誤検出回避）。
const CLAUDE_COMMANDS = new Set(['claude', 'node']);

function classifyGlyph(glyph: string): { known: boolean; working: boolean } {
  const code = glyph.codePointAt(0) ?? -1;
  const braille = code >= BRAILLE_MIN && code <= BRAILLE_MAX;
  const waiting = WAITING_GLYPHS.has(glyph);
  return { known: braille || waiting, working: braille };
}

/**
 * tmux の pane_current_command / pane_title から Claude の活動状態を判定する。
 * 在席でなければ undefined（= Claude無）。
 * @param command tmux の pane_current_command（basename）
 */
export function deriveClaudeStatus(
  command: string,
  title: string,
): ClaudeWindowStatus | undefined {
  const trimmed = title.replace(/^\s+/, '');
  const glyph = [...trimmed][0] ?? '';
  const { known, working } = classifyGlyph(glyph);

  if (!CLAUDE_COMMANDS.has(command)) {
    return undefined; // claude / node 以外は対象外
  }
  const present = command === 'claude' || (command === 'node' && known);
  if (!present) {
    return undefined; // node だが既知グリフ無し等
  }

  const activity: ClaudeActivity = working ? 'working' : 'waiting';
  const summary = (known ? trimmed.slice(glyph.length) : trimmed).trim();
  return summary ? { activity, summary } : { activity };
}
