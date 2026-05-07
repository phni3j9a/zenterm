/**
 * 画面幅で form factor を判定するためのブレークポイント。
 * - compact: iPhone 縦 / iPhone 横（小型） / iPad Stage Manager の狭い窓
 * - regular: iPad 縦横 / iPhone Plus・Pro Max 横 / Web デスクトップ
 *
 * Apple HIG の size class とは独立した、px ベースの単純しきい値。
 * Web 版でも同じ値を使う（`/embed/terminal` を含む全プラットフォーム共通）。
 */
export const breakpoints = {
  compact: 0,
  regular: 768,
} as const;

export type FormFactor = 'compact' | 'regular';
