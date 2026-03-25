#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'docs/mockups/ux-zen-light');

mkdirSync(outDir, { recursive: true });

const fonts = {
  sans: "'Noto Sans CJK JP','Noto Sans JP',sans-serif",
  serif: "'Noto Serif CJK JP',serif",
  mono: "'Noto Sans Mono',monospace",
};

const colors = {
  ink: '#2B241D',
  inkSoft: '#6F665C',
  inkMuted: '#A09587',
  line: '#DED4C7',
  paper: '#FBF8F2',
  paperWarm: '#F7F1E7',
  paperRaised: '#FFFAF3',
  warm: '#B86A3C',
  warmSoft: '#EEDCCB',
  moss: '#6D8267',
  mist: '#DCE7EA',
  gold: '#E8D29D',
  slate: '#8498A6',
  shell: '#241F1A',
  shellCut: '#14110E',
  white: '#FFF9F3',
};

const xml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const attrs = (input) =>
  Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `${key}="${xml(value)}"`)
    .join(' ');

const node = (name, input = {}, content = '') =>
  content === ''
    ? `<${name} ${attrs(input)} />`
    : `<${name} ${attrs(input)}>${content}</${name}>`;

const rect = (x, y, width, height, input = {}) => node('rect', { x, y, width, height, ...input });
const circle = (cx, cy, r, input = {}) => node('circle', { cx, cy, r, ...input });
const line = (x1, y1, x2, y2, input = {}) => node('line', { x1, y1, x2, y2, ...input });
const path = (d, input = {}) => node('path', { d, ...input });
const group = (content, input = {}) => node('g', input, content);

function text(x, y, value, input = {}) {
  return node(
    'text',
    {
      x,
      y,
      fill: colors.ink,
      'font-family': fonts.sans,
      'font-size': 16,
      'font-weight': 400,
      ...input,
    },
    xml(value),
  );
}

function serifText(x, y, value, input = {}) {
  return text(x, y, value, { 'font-family': fonts.serif, ...input });
}

function monoText(x, y, value, input = {}) {
  return text(x, y, value, { 'font-family': fonts.mono, ...input });
}

function pill(x, y, width, label, input = {}) {
  const {
    fill = colors.paperRaised,
    stroke = 'none',
    textFill = colors.inkSoft,
    iconFill,
    radius = 17,
    weight = 700,
  } = input;
  const icon = iconFill ? circle(x + 18, y + 17, 4.5, { fill: iconFill }) : '';
  const labelX = iconFill ? x + width / 2 + 8 : x + width / 2;
  return group(
    [
      rect(x, y, width, 34, { rx: radius, fill, stroke, 'stroke-width': stroke === 'none' ? undefined : 1 }),
      icon,
      text(labelX, y + 23, label, {
        'font-size': 13,
        'font-weight': weight,
        fill: textFill,
        'text-anchor': 'middle',
      }),
    ].join('\n'),
  );
}

function button(x, y, width, height, label, input = {}) {
  const {
    fill = colors.warm,
    stroke = 'none',
    textFill = colors.white,
    weight = 700,
    filter,
  } = input;
  return group(
    [
      rect(x, y, width, height, {
        rx: Math.round(height / 2.8),
        fill,
        stroke,
        'stroke-width': stroke === 'none' ? undefined : 1.1,
        filter,
      }),
      text(x + width / 2, y + height / 2 + 8, label, {
        'font-size': height >= 60 ? 21 : 18,
        'font-weight': weight,
        fill: textFill,
        'text-anchor': 'middle',
      }),
    ].join('\n'),
  );
}

function splitLabelCard(x, y, width, height, title, body, input = {}) {
  const { accent = colors.warm, fill = colors.paperRaised, footer } = input;
  return group(
    [
      rect(x, y, width, height, { rx: 24, fill, stroke: colors.line, 'stroke-width': 1, filter: 'url(#shadow-surface)' }),
      rect(x + 14, y + 14, 8, height - 28, { rx: 4, fill: accent }),
      text(x + 36, y + 36, title, { 'font-size': 13, 'font-weight': 700, fill: colors.inkSoft, 'letter-spacing': 0.6 }),
      text(x + 36, y + 66, body, { 'font-size': 19, 'font-weight': 600, fill: colors.ink }),
      footer ? monoText(x + 36, y + height - 24, footer, { 'font-size': 13, fill: colors.inkSoft }) : '',
    ].join('\n'),
  );
}

function listRow(y, input = {}) {
  const {
    title,
    subtitle,
    meta,
    iconFill = colors.warmSoft,
    accentFill = colors.warm,
    active = false,
    badge,
  } = input;
  const rowFill = active ? '#FFF5EA' : colors.paper;
  const outline = active ? colors.warmSoft : colors.line;
  return group(
    [
      rect(156, y, 408, 76, { rx: 24, fill: rowFill, stroke: outline, 'stroke-width': 1 }),
      circle(194, y + 38, 12, { fill: iconFill }),
      text(218, y + 34, title, { 'font-size': 18, 'font-weight': 600, fill: colors.ink }),
      text(218, y + 56, subtitle, { 'font-size': 13, fill: colors.inkSoft }),
      meta
        ? text(520, y + 34, meta, {
            'font-size': 12,
            'font-weight': 700,
            fill: active ? colors.warm : colors.inkMuted,
            'text-anchor': 'end',
          })
        : '',
      badge
        ? pill(432, y + 18, 116, badge, {
            fill: active ? colors.warmSoft : '#F1ECE3',
            textFill: active ? colors.warm : colors.inkSoft,
            iconFill: active ? colors.warm : colors.inkMuted,
          })
        : text(536, y + 45, '›', {
            'font-size': 26,
            'font-weight': 500,
            fill: active ? accentFill : colors.inkMuted,
            'text-anchor': 'middle',
          }),
    ].join('\n'),
  );
}

function statTile(x, y, width, label, value, detail, input = {}) {
  const { fill = colors.paperRaised, accent = colors.warmSoft } = input;
  return group(
    [
      rect(x, y, width, 112, { rx: 22, fill, stroke: colors.line, 'stroke-width': 1 }),
      rect(x + 16, y + 14, 42, 10, { rx: 5, fill: accent }),
      text(x + 18, y + 44, label, { 'font-size': 13, 'font-weight': 700, fill: colors.inkSoft }),
      text(x + 18, y + 84, value, { 'font-size': 24, 'font-weight': 700, fill: colors.ink }),
      text(x + 18, y + 104, detail, { 'font-size': 12, fill: colors.inkSoft }),
    ].join('\n'),
  );
}

function stepper(x, y, label, value) {
  return group(
    [
      rect(x, y, 408, 104, { rx: 24, fill: colors.paperRaised, stroke: colors.line, 'stroke-width': 1 }),
      text(x + 20, y + 34, label, { 'font-size': 14, 'font-weight': 700, fill: colors.inkSoft }),
      text(x + 20, y + 78, value, { 'font-size': 34, 'font-weight': 700, fill: colors.ink }),
      text(x + 20, y + 96, '6 - 20', { 'font-size': 12, fill: colors.inkMuted }),
      button(x + 300, y + 28, 38, 38, '-', {
        fill: colors.paper,
        stroke: colors.line,
        textFill: colors.inkSoft,
      }),
      button(x + 346, y + 28, 42, 38, '+', {
        fill: colors.warmSoft,
        textFill: colors.warm,
      }),
    ].join('\n'),
  );
}

function segmentedControl(x, y, activeIndex) {
  const labels = [
    { label: 'ライト', icon: 'sun' },
    { label: 'ダーク', icon: 'moon' },
  ];
  return group(
    [
      rect(x, y, 408, 72, { rx: 24, fill: colors.paperRaised, stroke: colors.line, 'stroke-width': 1 }),
      ...labels.map((item, index) => {
        const active = index === activeIndex;
        const bx = x + 12 + index * 194;
        return group(
          [
            rect(bx, y + 12, 190, 48, {
              rx: 18,
              fill: active ? colors.warm : colors.paper,
              stroke: active ? 'none' : colors.line,
              'stroke-width': active ? undefined : 1,
            }),
            circle(bx + 24, y + 36, 7, { fill: active ? colors.white : colors.inkMuted }),
            text(bx + 60, y + 41, item.label, {
              'font-size': 15,
              'font-weight': 700,
              fill: active ? colors.white : colors.inkSoft,
            }),
          ].join('\n'),
        );
      }),
    ].join('\n'),
  );
}

function navBar(activeLabel) {
  const items = [
    { key: 'work', label: '作業', cx: 208, pillX: 150 },
    { key: 'files', label: 'ファイル', cx: 360, pillX: 302 },
    { key: 'settings', label: '設定', cx: 512, pillX: 454 },
  ];
  const active = items.find((item) => item.key === activeLabel) ?? items[0];
  return group(
    [
      rect(144, 1056, 432, 80, { rx: 26, fill: '#FCF8F1', stroke: '#D7CCBE', 'stroke-width': 1.1 }),
      rect(active.pillX, 1064, 116, 50, { rx: 18, fill: '#F3DDCC' }),
      ...items.map((item) => {
        const selected = item.key === active.key;
        return group(
          [
            circle(item.cx, 1078, selected ? 5 : 4.5, { fill: selected ? colors.warm : colors.inkMuted }),
            text(item.cx, 1110, item.label, {
              'font-size': 14,
              'font-weight': selected ? 700 : 500,
              fill: selected ? colors.warm : colors.inkSoft,
              'text-anchor': 'middle',
            }),
          ].join('\n'),
        );
      }),
    ].join('\n'),
  );
}

function statusBar() {
  return [
    text(156, 172, '9:41', { 'font-size': 19, 'font-weight': 700, fill: colors.ink }),
    line(460, 162, 492, 162, { stroke: colors.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
    line(460, 170, 492, 170, { stroke: colors.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
    rect(510, 154, 42, 22, { rx: 7, fill: 'none', stroke: colors.ink, 'stroke-width': 1.8 }),
    rect(552, 160, 4, 10, { rx: 2, fill: colors.ink }),
    rect(513, 157, 28, 16, { rx: 5, fill: colors.moss }),
  ].join('\n');
}

function backdrop(width, height, input = {}) {
  const { large = false } = input;
  const circleOne = large ? { cx: 2360, cy: 180, r: 250 } : { cx: 636, cy: 110, r: 150 };
  const circleTwo = large ? { cx: 220, cy: 1600, r: 310 } : { cx: 92, cy: 1330, r: 166 };
  const circleThree = large ? { cx: 2180, cy: 1520, r: 190 } : { cx: 560, cy: 1300, r: 118 };
  const loopCx = large ? 2140 : 566;
  const loopCy = large ? 360 : 134;
  const loopR = large ? 162 : 104;
  return [
    rect(0, 0, width, height, { fill: '#F8F2E8' }),
    circle(circleOne.cx, circleOne.cy, circleOne.r, { fill: colors.warmSoft, opacity: 0.42 }),
    circle(circleTwo.cx, circleTwo.cy, circleTwo.r, { fill: colors.mist, opacity: 0.7 }),
    circle(circleThree.cx, circleThree.cy, circleThree.r, { fill: '#F4ECD9', opacity: 0.85 }),
    circle(loopCx, loopCy, loopR, {
      fill: 'none',
      stroke: colors.warm,
      'stroke-width': large ? 20 : 16,
      'stroke-linecap': 'round',
      'stroke-dasharray': large ? '602 158' : '390 120',
      opacity: 0.24,
      transform: `rotate(-24 ${loopCx} ${loopCy})`,
    }),
    path(
      large
        ? 'M 0 1220 C 420 1120, 600 1240, 980 1180 S 1660 1020, 2600 1120'
        : 'M 0 920 C 140 876, 260 940, 420 916 S 620 842, 720 882',
      { fill: 'none', stroke: '#EFE5D7', 'stroke-width': large ? 26 : 18, opacity: 0.52 },
    ),
  ].join('\n');
}

function phoneFrame(body) {
  return group(
    [
      rect(118, 118, 484, 1040, { rx: 62, fill: colors.shell }),
      rect(132, 132, 456, 1012, { rx: 48, fill: colors.paper }),
      rect(273, 140, 174, 32, { rx: 20, fill: colors.shellCut }),
      rect(132, 132, 456, 1012, { rx: 48, fill: '#FEFBF6' }),
      circle(516, 298, 60, { fill: colors.warmSoft, opacity: 0.34 }),
      circle(516, 298, 46, {
        fill: 'none',
        stroke: colors.warm,
        'stroke-width': 10,
        'stroke-linecap': 'round',
        'stroke-dasharray': '168 80',
        opacity: 0.34,
        transform: 'rotate(-36 516 298)',
      }),
      statusBar(),
      body,
      rect(314, 1146, 90, 5, { rx: 3, fill: '#3C342C', opacity: 0.68 }),
    ].join('\n'),
    { filter: 'url(#shadow-phone)' },
  );
}

function screenPoster(section, subtitle, body) {
  return [
    backdrop(720, 1460),
    text(120, 70, section, {
      'font-size': 16,
      'font-weight': 700,
      fill: colors.inkSoft,
      'letter-spacing': 2.8,
    }),
    text(120, 94, subtitle, {
      'font-size': 13,
      fill: colors.inkMuted,
    }),
    phoneFrame(body),
  ].join('\n');
}

function wrapSvg(width, height, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="shadow-phone" x="-40%" y="-40%" width="180%" height="220%">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000000" flood-opacity="0.16" />
    </filter>
    <filter id="shadow-surface" x="-40%" y="-40%" width="180%" height="220%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.08" />
    </filter>
    <filter id="shadow-card" x="-40%" y="-40%" width="180%" height="220%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.08" />
    </filter>
    <linearGradient id="page-wash" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8F2E8" />
      <stop offset="55%" stop-color="#F6EFE4" />
      <stop offset="100%" stop-color="#EEE5D6" />
    </linearGradient>
    <linearGradient id="screen-wash" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEFBF6" />
      <stop offset="100%" stop-color="#F7F0E6" />
    </linearGradient>
    <linearGradient id="accent-band" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#B86A3C" />
      <stop offset="100%" stop-color="#D78A59" />
    </linearGradient>
    <pattern id="paper-grain" width="120" height="120" patternUnits="userSpaceOnUse">
      <circle cx="18" cy="22" r="1.2" fill="#D8CFBF" opacity="0.34" />
      <circle cx="72" cy="30" r="1.1" fill="#E6DCCC" opacity="0.4" />
      <circle cx="100" cy="78" r="1.3" fill="#D8CFBF" opacity="0.28" />
      <circle cx="48" cy="92" r="1.1" fill="#E6DCCC" opacity="0.35" />
      <circle cx="14" cy="102" r="1.2" fill="#CFC4B4" opacity="0.24" />
      <circle cx="88" cy="14" r="1.4" fill="#EADFCF" opacity="0.24" />
    </pattern>
  </defs>
  ${content}
</svg>`;
}

function onboardingBody() {
  return [
    pill(156, 202, 128, 'quiet setup', { fill: '#F3E8DA', textFill: colors.warm, iconFill: colors.warm }),
    pill(458, 202, 106, '2 min', { fill: '#E8F0EA', textFill: colors.moss, iconFill: colors.moss }),
    circle(356, 346, 94, { fill: colors.paperRaised, opacity: 0.72 }),
    circle(356, 346, 84, {
      fill: 'none',
      stroke: 'url(#accent-band)',
      'stroke-width': 18,
      'stroke-linecap': 'round',
      'stroke-dasharray': '392 126',
      transform: 'rotate(-38 356 346)',
    }),
    text(356, 370, '>', {
      'font-family': fonts.mono,
      'font-size': 56,
      'font-weight': 700,
      fill: colors.ink,
      'text-anchor': 'middle',
    }),
    serifText(356, 510, 'ZenTerm', {
      'font-size': 38,
      'font-weight': 700,
      fill: colors.ink,
      'text-anchor': 'middle',
    }),
    text(356, 548, '静かに接続して、そのまま作業へ戻る', {
      'font-size': 17,
      'font-weight': 600,
      fill: colors.inkSoft,
      'text-anchor': 'middle',
    }),
    text(356, 574, 'URL・token・既定サーバーを QR でまとめて受け取る', {
      'font-size': 14,
      fill: colors.inkMuted,
      'text-anchor': 'middle',
    }),
    splitLabelCard(158, 622, 396, 112, 'AUTO FILL', 'Gateway を見つけたら、接続先を一気に反映', {
      accent: colors.warm,
      footer: 'raspi5 / 100.80.218.99 / token ready',
    }),
    button(160, 770, 392, 64, 'QRで接続', { fill: colors.warm, textFill: colors.white, filter: 'url(#shadow-surface)' }),
    button(160, 848, 392, 56, 'URLを入力', {
      fill: colors.paperRaised,
      stroke: colors.line,
      textFill: colors.ink,
    }),
    rect(158, 936, 396, 136, { rx: 28, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1 }),
    text(182, 970, '接続の流れ', { 'font-size': 14, 'font-weight': 700, fill: colors.inkSoft }),
    line(208, 1014, 504, 1014, { stroke: '#E8DDCF', 'stroke-width': 2 }),
    ...[
      { n: '1', x: 208, title: 'Gateway', detail: 'サーバー側を起動' },
      { n: '2', x: 356, title: 'QR 読取', detail: '接続先を自動入力' },
      { n: '3', x: 504, title: '再開', detail: '前回の作業へ' },
    ].flatMap((step) => [
      circle(step.x, 1014, 18, { fill: colors.paperRaised, stroke: colors.line, 'stroke-width': 1 }),
      text(step.x, 1020, step.n, {
        'font-size': 14,
        'font-weight': 700,
        fill: colors.warm,
        'text-anchor': 'middle',
      }),
      text(step.x, 1056, step.title, {
        'font-size': 14,
        'font-weight': 700,
        fill: colors.ink,
        'text-anchor': 'middle',
      }),
      text(step.x, 1078, step.detail, {
        'font-size': 12,
        fill: colors.inkSoft,
        'text-anchor': 'middle',
      }),
    ]),
  ].join('\n');
}

function workBody() {
  return [
    text(156, 224, 'おかえりなさい', {
      'font-family': fonts.serif,
      'font-size': 30,
      'font-weight': 700,
      fill: colors.ink,
    }),
    pill(452, 202, 112, 'raspi5 接続中', {
      fill: '#E7EEE5',
      textFill: colors.moss,
      iconFill: colors.moss,
    }),
    rect(156, 258, 408, 244, { rx: 30, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1, filter: 'url(#shadow-surface)' }),
    rect(172, 278, 124, 34, { rx: 17, fill: '#F3E8DA' }),
    text(234, 301, 'RESUME', { 'font-size': 13, 'font-weight': 700, fill: colors.warm, 'text-anchor': 'middle', 'letter-spacing': 1 }),
    serifText(180, 356, 'codex', { 'font-size': 52, 'font-weight': 700, fill: colors.ink }),
    monoText(180, 386, '/home/raspi5/projects/zenterm', { 'font-size': 14, fill: colors.inkSoft }),
    pill(180, 406, 110, 'tmux active', { fill: '#E7EEE5', textFill: colors.moss, iconFill: colors.moss }),
    pill(300, 406, 98, '2分前', { fill: '#F1ECE3', textFill: colors.inkSoft, iconFill: colors.inkMuted }),
    path('M 432 322 C 462 286, 506 282, 532 320 S 530 406, 486 420', {
      fill: 'none',
      stroke: '#D9C6B4',
      'stroke-width': 10,
      'stroke-linecap': 'round',
      opacity: 0.85,
    }),
    circle(492, 348, 40, {
      fill: 'none',
      stroke: colors.warm,
      'stroke-width': 9,
      'stroke-linecap': 'round',
      'stroke-dasharray': '116 58',
      opacity: 0.62,
      transform: 'rotate(-48 492 348)',
    }),
    monoText(430, 438, '$ git status', { 'font-size': 13, fill: colors.inkMuted }),
    monoText(430, 462, 'mockups refreshed', { 'font-size': 13, fill: colors.inkSoft }),
    button(180, 438, 122, 48, '再開', { fill: colors.warm, textFill: colors.white }),
    button(314, 438, 124, 48, '新規', { fill: colors.warmSoft, textFill: colors.warm }),
    line(156, 536, 564, 536, { stroke: '#E7DED2', 'stroke-width': 1.2 }),
    text(156, 570, '最近のセッション', { 'font-size': 18, 'font-weight': 700, fill: colors.inkSoft }),
    listRow(596, {
      title: 'codex',
      subtitle: '/projects/zenterm ・ inline preview',
      meta: '2分前',
      iconFill: colors.warmSoft,
      active: true,
      badge: '再開候補',
    }),
    listRow(682, {
      title: 'deploy',
      subtitle: '/home/raspi5/projects ・ 1時間前',
      meta: 'idle',
      iconFill: colors.mist,
      accentFill: colors.slate,
    }),
    listRow(768, {
      title: 'logs',
      subtitle: '/var/log ・ 昨日',
      meta: 'read only',
      iconFill: '#F2ECE1',
      accentFill: '#B89455',
    }),
    rect(156, 864, 408, 96, { rx: 26, fill: colors.paperRaised, stroke: colors.line, 'stroke-width': 1 }),
    text(178, 898, 'IN-LINE TERMINAL', { 'font-size': 13, 'font-weight': 700, fill: colors.inkSoft, 'letter-spacing': 0.6 }),
    monoText(178, 928, '$ npm run test -w packages/mobile', { 'font-size': 14, fill: colors.ink }),
    text(178, 950, 'スワイプで別セッションへ。開いたまま一覧に戻れる。', { 'font-size': 13, fill: colors.inkSoft }),
    navBar('work'),
  ].join('\n');
}

function filesBody() {
  return [
    serifText(356, 226, 'ファイル', {
      'font-size': 26,
      'font-weight': 600,
      fill: colors.ink,
      'text-anchor': 'middle',
    }),
    pill(470, 198, 94, '＋ 新規', { fill: '#F3E8DA', textFill: colors.warm }),
    rect(156, 258, 408, 88, { rx: 24, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1 }),
    pill(172, 272, 126, '作業の場所', { fill: colors.warmSoft, textFill: colors.warm }),
    monoText(172, 328, '/home/raspi5/projects/zenterm', { 'font-size': 13, fill: colors.inkSoft }),
    pill(156, 370, 118, '新しい順', { fill: colors.warmSoft, textFill: colors.warm, iconFill: colors.warm }),
    pill(284, 370, 108, '隠し off', { fill: '#F1ECE3', textFill: colors.inkSoft, iconFill: colors.inkMuted }),
    pill(402, 370, 162, 'upload ready', { fill: '#E8F0EA', textFill: colors.moss, iconFill: colors.moss }),
    listRow(424, {
      title: 'packages',
      subtitle: 'directory ・ 3 workspaces',
      meta: '14 items',
      iconFill: colors.warmSoft,
    }),
    listRow(510, {
      title: 'docs',
      subtitle: 'mockups / deployment',
      meta: '7 items',
      iconFill: colors.mist,
    }),
    listRow(596, {
      title: 'README.md',
      subtitle: 'markdown ・ 3.2 KB',
      meta: 'selected',
      iconFill: '#F2ECE1',
      active: true,
      badge: 'preview',
    }),
    listRow(682, {
      title: 'icon-preview.png',
      subtitle: 'image ・ 36 KB',
      meta: 'image',
      iconFill: colors.mist,
      accentFill: colors.slate,
    }),
    rect(156, 790, 408, 170, { rx: 28, fill: colors.paperRaised, stroke: colors.line, 'stroke-width': 1, filter: 'url(#shadow-surface)' }),
    text(180, 826, 'README.md', { 'font-size': 18, 'font-weight': 700, fill: colors.ink }),
    pill(456, 804, 84, 'markdown', { fill: '#F1ECE3', textFill: colors.inkSoft }),
    monoText(180, 856, '# ZenTerm', { 'font-size': 15, fill: colors.warm }),
    text(180, 886, 'モバイルから Raspberry Pi に静かにつながるターミナル。', {
      'font-size': 15,
      fill: colors.ink,
    }),
    text(180, 914, 'QR onboarding / tmux resume / light terminal preview', {
      'font-size': 13,
      fill: colors.inkSoft,
    }),
    text(180, 946, 'タップで全文を開き、Markdown と画像をその場で確認。', {
      'font-size': 13,
      fill: colors.inkMuted,
    }),
    navBar('files'),
  ].join('\n');
}

function settingsBody() {
  return [
    serifText(356, 226, '設定', {
      'font-size': 26,
      'font-weight': 600,
      fill: colors.ink,
      'text-anchor': 'middle',
    }),
    rect(156, 258, 408, 180, { rx: 30, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1, filter: 'url(#shadow-surface)' }),
    serifText(178, 314, 'raspi5', { 'font-size': 42, 'font-weight': 700, fill: colors.ink }),
    monoText(178, 344, '100.80.218.99:18765', { 'font-size': 14, fill: colors.inkSoft }),
    pill(444, 278, 110, '接続中', { fill: '#E7EEE5', textFill: colors.moss, iconFill: colors.moss }),
    text(178, 378, '稼働 9日 6時間 ・ Tailscale / LAN', { 'font-size': 14, 'font-weight': 500, fill: colors.inkSoft }),
    path('M 430 348 C 450 336, 462 328, 474 338 S 498 370, 516 356 S 542 332, 554 344', {
      fill: 'none',
      stroke: colors.warm,
      'stroke-width': 5,
      'stroke-linecap': 'round',
      opacity: 0.72,
    }),
    pill(178, 396, 92, 'Tailscale', { fill: '#F1ECE3', textFill: colors.inkSoft }),
    pill(280, 396, 72, 'LAN', { fill: '#F1ECE3', textFill: colors.inkSoft }),
    statTile(156, 464, 126, 'CPU', '13%', '4 cores', { fill: '#EAF1E8', accent: '#C9D9C3' }),
    statTile(292, 464, 126, 'Memory', '33%', '2.6 / 7.9 GB', { fill: '#EDF3F7', accent: '#C8D7E1' }),
    statTile(428, 464, 126, 'Disk', '14%', '31.7 / 233 GB', { fill: '#F7F0DF', accent: '#E6D5A8' }),
    text(156, 620, '外観', { 'font-size': 14, 'font-weight': 700, fill: colors.inkSoft }),
    segmentedControl(156, 636, 0),
    text(156, 742, 'ターミナル', { 'font-size': 14, 'font-weight': 700, fill: colors.inkSoft }),
    stepper(156, 758, 'フォントサイズ', '15'),
    listRow(888, {
      title: 'サーバー管理',
      subtitle: '登録済み 2台 ・ QR で追加',
      meta: 'manage',
      iconFill: colors.warmSoft,
      active: true,
      badge: 'servers',
    }),
    navBar('settings'),
  ].join('\n');
}

function terminalBody() {
  return [
    text(160, 226, '‹', {
      'font-size': 28,
      'font-weight': 600,
      fill: colors.ink,
    }),
    serifText(356, 226, 'codex', {
      'font-size': 26,
      'font-weight': 700,
      fill: colors.ink,
      'text-anchor': 'middle',
    }),
    pill(470, 198, 94, '接続中', { fill: '#E7EEE5', textFill: colors.moss, iconFill: colors.moss }),
    rect(156, 258, 408, 42, { rx: 18, fill: '#F1ECE3', stroke: 'none' }),
    monoText(176, 284, '/home/raspi5/projects/zenterm', { 'font-size': 13, fill: colors.inkSoft }),
    rect(154, 320, 412, 582, { rx: 30, fill: '#F8F2E8', stroke: colors.line, 'stroke-width': 1 }),
    rect(168, 340, 384, 44, { rx: 16, fill: '#FBF6EE' }),
    pill(184, 346, 94, 'tmux codex', { fill: '#E8F0EA', textFill: colors.moss, iconFill: colors.moss }),
    monoText(448, 370, 'resumed 2m ago', { 'font-size': 12, fill: colors.inkMuted, 'text-anchor': 'end' }),
    monoText(176, 430, '$ npm run mock:zen-light', { 'font-size': 17, fill: colors.ink }),
    monoText(176, 464, '> write refreshed mock SVGs', { 'font-size': 17, fill: colors.moss }),
    rect(170, 486, 280, 28, { rx: 8, fill: '#E8D2C1', opacity: 0.62 }),
    monoText(176, 508, '> render board + screens', { 'font-size': 17, fill: colors.ink }),
    monoText(176, 548, '$ git diff --stat', { 'font-size': 17, fill: colors.ink }),
    monoText(176, 582, 'docs/mockups/ux-zen-light  |  refreshed', { 'font-size': 17, fill: colors.inkSoft }),
    monoText(176, 616, 'scripts/generate-zen-light-mockups.mjs', { 'font-size': 17, fill: colors.inkSoft }),
    monoText(176, 688, '$ magick *.svg *.png', { 'font-size': 17, fill: colors.ink }),
    monoText(176, 722, '> all previews exported', { 'font-size': 17, fill: colors.moss }),
    monoText(176, 788, 'quiet paper terminal / light by default', { 'font-size': 17, fill: colors.inkMuted }),
    monoText(176, 850, '▍', { 'font-size': 24, 'font-weight': 700, fill: colors.warm }),
    rect(156, 920, 408, 62, { rx: 22, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1 }),
    text(178, 948, 'raspi5 / tmux / mobile focus keys', { 'font-size': 13, 'font-weight': 700, fill: colors.inkSoft }),
    text(178, 970, '一覧に戻っても状態を崩さず、必要なキーだけ下に残す。', { 'font-size': 13, fill: colors.inkMuted }),
    rect(154, 1002, 412, 58, { rx: 24, fill: '#F8F2E8', stroke: '#D7CCBE', 'stroke-width': 1.1 }),
    button(166, 1014, 58, 34, 'Esc', { fill: colors.paperRaised, stroke: colors.line, textFill: colors.inkSoft }),
    button(232, 1014, 58, 34, 'Tab', { fill: colors.paperRaised, stroke: colors.line, textFill: colors.inkSoft }),
    button(298, 1014, 58, 34, 'Ctrl', { fill: colors.warmSoft, textFill: colors.warm }),
    button(364, 1014, 68, 34, 'Paste', { fill: colors.paperRaised, stroke: colors.line, textFill: colors.inkSoft }),
    button(440, 1014, 70, 34, 'More', { fill: colors.paperRaised, stroke: colors.line, textFill: colors.inkSoft }),
  ].join('\n');
}

const screens = [
  {
    filename: 'zenterm-zen-light-onboarding.svg',
    section: 'ONBOARDING',
    subtitle: 'quiet setup with a single decisive action',
    body: onboardingBody(),
  },
  {
    filename: 'zenterm-zen-light-work.svg',
    section: 'WORK',
    subtitle: 'resume-first sessions with breathing room',
    body: workBody(),
  },
  {
    filename: 'zenterm-zen-light-files.svg',
    section: 'FILES',
    subtitle: 'context-rich browser with preview at hand',
    body: filesBody(),
  },
  {
    filename: 'zenterm-zen-light-server.svg',
    section: 'SETTINGS',
    subtitle: 'server-aware quiet control',
    body: settingsBody(),
  },
  {
    filename: 'zenterm-zen-light-terminal.svg',
    section: 'TERMINAL',
    subtitle: 'paper terminal with focused key row',
    body: terminalBody(),
  },
];

function boardCard(x, y, width, height, title, body, accent) {
  return group(
    [
      rect(x, y, width, height, { rx: 28, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1, filter: 'url(#shadow-card)' }),
      rect(x + 22, y + 20, 72, 10, { rx: 5, fill: accent }),
      text(x + 22, y + 56, title, { 'font-size': 20, 'font-weight': 700, fill: colors.ink }),
      text(x + 22, y + 90, body, { 'font-size': 15, fill: colors.inkSoft }),
    ].join('\n'),
  );
}

function paletteSwatch(x, y, fill, label) {
  return group(
    [
      rect(x, y, 124, 96, { rx: 22, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1 }),
      rect(x + 18, y + 18, 88, 38, { rx: 16, fill }),
      text(x + 62, y + 78, label, { 'font-size': 13, 'font-weight': 700, fill: colors.inkSoft, 'text-anchor': 'middle' }),
    ].join('\n'),
  );
}

function boardPoster(screen, x, y, scale, rotate = 0) {
  return group(screenPoster(screen.section, screen.subtitle, screen.body), {
    transform: `translate(${x} ${y}) rotate(${rotate}) scale(${scale})`,
  });
}

function boardSvg() {
  return wrapSvg(
    2600,
    1880,
    [
      backdrop(2600, 1880, { large: true }),
      serifText(140, 154, 'Zen Light Mockups', {
        'font-size': 62,
        'font-weight': 700,
        fill: colors.ink,
      }),
      text(140, 206, 'paper terminal / resume-first navigation / app-aligned information hierarchy', {
        'font-size': 24,
        fill: colors.inkSoft,
      }),
      boardCard(1740, 272, 680, 156, 'Resume First', 'セッション一覧の最上段を「前回の続き」に寄せ、再開を主役に戻す。', colors.warm),
      boardCard(1740, 452, 680, 156, 'Quiet Layers', '紙の階調を 3 層に限定し、強い操作だけ暖色で拾う。', colors.moss),
      boardCard(1740, 632, 680, 156, 'Readable Mono', 'ライト端末でも読みやすい行間と、操作キーの密度を整理。', colors.gold),
      text(1740, 852, 'Palette', { 'font-size': 18, 'font-weight': 700, fill: colors.ink }),
      paletteSwatch(1740, 878, colors.warm, 'Accent'),
      paletteSwatch(1882, 878, colors.warmSoft, 'Warm Soft'),
      paletteSwatch(2024, 878, colors.moss, 'Moss'),
      paletteSwatch(2166, 878, colors.mist, 'Mist'),
      rect(1740, 1016, 680, 206, { rx: 30, fill: '#FCF7EF', stroke: colors.line, 'stroke-width': 1, filter: 'url(#shadow-card)' }),
      text(1766, 1060, 'What Changed', { 'font-size': 20, 'font-weight': 700, fill: colors.ink }),
      text(1766, 1100, '1. Onboarding は QR 一択の重心に再配置', { 'font-size': 15, fill: colors.inkSoft }),
      text(1766, 1134, '2. Sessions / Files / Settings を現行タブ構成に整列', { 'font-size': 15, fill: colors.inkSoft }),
      text(1766, 1168, '3. Terminal は light default を明確に視覚化', { 'font-size': 15, fill: colors.inkSoft }),
      monoText(1766, 1204, 'docs/mockups/ux-zen-light/*.svg + *.png', { 'font-size': 14, fill: colors.inkMuted }),
      boardPoster(screens[0], 70, 252, 0.5, -2),
      boardPoster(screens[1], 460, 252, 0.5, 1.3),
      boardPoster(screens[2], 850, 252, 0.5, -0.8),
      boardPoster(screens[3], 300, 1010, 0.5, -1.2),
      boardPoster(screens[4], 760, 1010, 0.5, 1.1),
    ].join('\n'),
  );
}

for (const screen of screens) {
  const svg = wrapSvg(720, 1460, screenPoster(screen.section, screen.subtitle, screen.body));
  writeFileSync(join(outDir, screen.filename), svg);
}

writeFileSync(join(outDir, 'zenterm-zen-light-board.svg'), boardSvg());

process.stdout.write(`Generated ${screens.length + 1} SVG mockups in ${outDir}\n`);
