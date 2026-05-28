#!/usr/bin/env python3
"""PC Web 版 (packages/web) 用のライト/ダーク両対応 favicon.svg を生成する。

LP 用の 1024px 円相アイコン (lp/icon-light.png = 黒ストローク,
lp/icon-dark.png = 白ストローク) を素材に、透明背景を軽くトリムして
正方形 128px に縮小し、base64 で 1 枚の SVG に埋め込む。
@media (prefers-color-scheme: dark) でタブ背景に追従して切り替わる。

  Chrome / Firefox / Edge : テーマに追従 (リロード不要)
  Safari                  : SVG favicon 内の media query 非対応 → ライト版固定
  旧ブラウザ              : favicon.ico にフォールバック

出力: packages/web/public/favicon.svg
"""
import base64
import io
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "packages/gateway/public/lp"
OUT = ROOT / "packages/web/public/favicon.svg"

SIZE = 64           # 埋め込み PNG の一辺 (favicon は 16-32px 描画。64 で十分)
ALPHA_THRESHOLD = 32  # トリム時に「中身」とみなす最小 alpha
MARGIN_RATIO = 0.06   # トリム後に足す余白 (ストローク端のクリップ防止)


def prep(path: pathlib.Path) -> str:
    """透明背景をトリム → 正方形パディング → SIZE に縮小 → base64(PNG)。"""
    im = Image.open(path).convert("RGBA")
    # alpha > 閾値 の bbox にトリム
    alpha = im.getchannel("A")
    mask = alpha.point(lambda a: 255 if a >= ALPHA_THRESHOLD else 0)
    bbox = mask.getbbox()
    if bbox:
        im = im.crop(bbox)
    # 余白付きの正方形キャンバスへ中央配置 (透明背景)
    side = max(im.size)
    margin = int(side * MARGIN_RATIO)
    canvas_side = side + margin * 2
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    canvas.paste(im, ((canvas_side - im.width) // 2, (canvas_side - im.height) // 2))
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main() -> None:
    light_b64 = prep(SRC / "icon-light.png")  # 黒ストローク (ライト背景用)
    dark_b64 = prep(SRC / "icon-dark.png")    # 白ストローク (ダーク背景用)
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">
  <style>
    .dark {{ display: none; }}
    @media (prefers-color-scheme: dark) {{
      .light {{ display: none; }}
      .dark {{ display: inline; }}
    }}
  </style>
  <image class="light" width="{SIZE}" height="{SIZE}" href="data:image/png;base64,{light_b64}"/>
  <image class="dark" width="{SIZE}" height="{SIZE}" href="data:image/png;base64,{dark_b64}"/>
</svg>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
