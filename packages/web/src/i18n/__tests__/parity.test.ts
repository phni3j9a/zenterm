import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import ja from '../locales/ja.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ptBR from '../locales/pt-BR.json';
import zhCN from '../locales/zh-CN.json';
import ko from '../locales/ko.json';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') keys.push(full);
    else if (typeof v === 'object' && v !== null) keys.push(...collectKeys(v, full));
  }
  return keys.sort();
}

describe('i18n locale parity', () => {
  const enKeys = collectKeys(en);
  const locales: { name: string; dict: unknown }[] = [
    { name: 'ja', dict: ja },
    { name: 'es', dict: es },
    { name: 'fr', dict: fr },
    { name: 'de', dict: de },
    { name: 'pt-BR', dict: ptBR },
    { name: 'zh-CN', dict: zhCN },
    { name: 'ko', dict: ko },
  ];
  for (const { name, dict } of locales) {
    it(`${name} has same keys as en`, () => {
      const keys = collectKeys(dict);
      const missing = enKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }
});
