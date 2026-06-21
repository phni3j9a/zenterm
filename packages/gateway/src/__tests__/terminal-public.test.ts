import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const terminalHtml = readFileSync(
  new URL('../../public/terminal/index.html', import.meta.url),
  'utf8',
);
const terminalFont = new URL(
  '../../public/terminal/fonts/NotoSansMonoCJKjp-Regular.otf',
  import.meta.url,
);
const terminalFontLicense = new URL(
  '../../public/terminal/fonts/OFL.txt',
  import.meta.url,
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

  it('loads the bundled Japanese monospace font before xterm starts', () => {
    expect(terminalHtml).toContain('font-family: "ZenTerm Terminal CJK";');
    expect(terminalHtml).toContain('url("/terminal/fonts/NotoSansMonoCJKjp-Regular.otf") format("opentype")');
    expect(terminalHtml).toContain('font-display: block;');
    expect(terminalHtml).toContain('var terminalFontFamily = \'"ZenTerm Terminal CJK"');
    expect(terminalHtml).toContain('function loadTerminalFont()');
    expect(terminalHtml).toContain('document.fonts.load(fontSize + \'px "ZenTerm Terminal CJK"\')');
    expect(terminalHtml).toContain('loadTerminalFont().then(startTerminal);');
  });

  it('ships the bundled terminal font and its OFL license', () => {
    expect(statSync(terminalFont).size).toBeGreaterThan(10_000_000);
    expect(readFileSync(terminalFontLicense, 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});
