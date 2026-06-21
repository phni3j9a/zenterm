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

/**
 * フォルダブル展開のような「大型・近似正方形」画面を regular に含めるための閾値。
 * - minSide: 短辺(dp)の下限。スマホ(短辺 ~390-430)を除外する。
 * - minAspect: 短辺/長辺の下限。iPad 縦(0.66-0.70)を除外しつつ Fold7(0.90)を拾う。
 */
export const foldable = {
  minSide: 700,
  minAspect: 0.83,
} as const;

export type FormFactor = 'compact' | 'regular';

/**
 * 画面の幅・高さ(dp)から FormFactor を判定する純関数。
 * regular = 幅 >= 768  もしくは  (短辺 >= 700 かつ 短辺/長辺 >= 0.83)
 */
export function computeFormFactor(width: number, height: number): FormFactor {
  if (width >= breakpoints.regular) {
    return 'regular';
  }
  const minSide = Math.min(width, height);
  const maxSide = Math.max(width, height);
  const aspect = maxSide === 0 ? 0 : minSide / maxSide;
  if (minSide >= foldable.minSide && aspect >= foldable.minAspect) {
    return 'regular';
  }
  return 'compact';
}
