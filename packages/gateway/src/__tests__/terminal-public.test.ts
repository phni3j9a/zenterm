import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const terminalHtml = readFileSync(
  new URL('../../public/terminal/index.html', import.meta.url),
  'utf8',
);

describe('terminal public page', () => {
  it('skips focus when noFocus is requested for bridge input', () => {
    expect(terminalHtml).toContain('if (!message.noFocus) {');
    expect(terminalHtml).toContain('term.focus();');
    expect(terminalHtml).toContain("if (typeof term.input === 'function') {");
  });

  it('hides the xterm viewport scrollbar', () => {
    expect(terminalHtml).toContain('.xterm-viewport {');
    expect(terminalHtml).toContain('scrollbar-width: none;');
    expect(terminalHtml).toContain('.xterm-viewport::-webkit-scrollbar {');
    expect(terminalHtml).toContain('display: none;');
  });
});
