/**
 * Master-Detail レイアウト・ペイン分割で使う構造寸法。
 * 数値は dp（モバイル）/ px（Web）で同一値として扱う。
 * 色・タイポグラフィ・spacing は app 側 `src/theme/` に残し、
 * ここには「サイズ・幅」だけを置く。
 */
export const layout = {
  sidebar: {
    width: 280,
    minWidth: 240,
    iconBarWidth: 56,
  },
  detailPane: {
    minWidth: 320,
  },
  splitDivider: {
    width: 1,
  },
} as const;
