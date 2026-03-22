#!/usr/bin/env python3
"""Generate ZenTerm app icon & splash — brush-painted enso + prompt."""

import math
import random
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
CENTER = SIZE // 2

# App light theme palette
BG = (253, 252, 250)         # #FDFCFA
TEXT = (44, 42, 37)          # #2C2A25
PRIMARY = (44, 42, 37)       # #2C2A25 — same as enso
TEXT_SEC = (112, 108, 99)    # #706C63


def brush_stroke(draw, points, max_width, color, seed=0):
    """Draw a brush stroke along a list of (x,y) points with ink-like variation.

    Simulates: pressure variation, slight wobble, and tapered ends.
    """
    rng = random.Random(seed)
    n = len(points)
    if n < 2:
        return

    for i in range(n):
        t = i / (n - 1)  # 0..1
        x, y = points[i]

        # Pressure curve: thin → thick → thin
        if t < 0.08:
            pressure = 0.15 + 0.85 * (t / 0.08)
        elif t > 0.90:
            fade = (1.0 - t) / 0.10
            pressure = 0.06 + 0.94 * fade * fade
        else:
            # Natural wobble in the middle
            pressure = 0.82 + 0.18 * math.sin(t * math.pi * 0.85)

        # Add slight random ink variation
        pressure *= (0.92 + 0.08 * rng.random())

        w = max(1.5, max_width * pressure)

        # Slight positional wobble for hand-drawn feel
        wobble = max_width * 0.02
        wx = x + rng.uniform(-wobble, wobble)
        wy = y + rng.uniform(-wobble, wobble)

        r = w / 2
        draw.ellipse([wx - r, wy - r, wx + r, wy + r], fill=color)


def make_circle_points(cx, cy, radius, start_deg, sweep_deg, num_points):
    """Generate points along a circular arc."""
    pts = []
    for i in range(num_points):
        t = i / (num_points - 1)
        angle = math.radians(start_deg + sweep_deg * t)
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        pts.append((x, y))
    return pts


def make_line_points(x1, y1, x2, y2, num_points=80):
    """Generate points along a straight line."""
    pts = []
    for i in range(num_points):
        t = i / (num_points - 1)
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t
        pts.append((x, y))
    return pts


def draw_brush_chevron(draw, cx, cy, size, width, color):
    """Draw '>' as two brush strokes meeting at a point."""
    half = size / 2
    # Top-left to center-right (upper stroke of >)
    pts_upper = make_line_points(
        cx - half * 0.75, cy - half,
        cx + half * 0.75, cy,
        num_points=100
    )
    # Center-right to bottom-left (lower stroke of >)
    pts_lower = make_line_points(
        cx + half * 0.75, cy,
        cx - half * 0.75, cy + half,
        num_points=100
    )
    brush_stroke(draw, pts_upper, width, color, seed=42)
    brush_stroke(draw, pts_lower, width, color, seed=57)


def draw_brush_cursor(draw, cx, cy, height, width, color):
    """Draw '|' cursor as a single vertical brush stroke."""
    half_h = height / 2
    pts = make_line_points(cx, cy - half_h, cx, cy + half_h, num_points=80)
    brush_stroke(draw, pts, width, color, seed=99)


def draw_enso_layer(size, cx, cy, radius, max_width, color):
    """Draw enso on a separate RGBA layer."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Gap at bottom (~6 o'clock), nearly closed
    pts = make_circle_points(cx, cy, radius,
                             start_deg=110, sweep_deg=335,
                             num_points=400)
    brush_stroke(d, pts, max_width, color, seed=7)
    return layer


def get_sans_font(size):
    from PIL import ImageFont
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Light.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def create_icon():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background
    draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=220, fill=BG)

    # Enso
    enso_cy = CENTER - 15
    enso_radius = 270
    enso_width = 56

    enso_layer = draw_enso_layer(SIZE, CENTER, enso_cy, enso_radius, enso_width, TEXT)
    # Subtle ink bleed
    enso_soft = enso_layer.filter(ImageFilter.GaussianBlur(radius=1.5))
    img = Image.alpha_composite(img, enso_soft)
    img = Image.alpha_composite(img, enso_layer)

    # Brush-painted prompt
    prompt_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    pd = ImageDraw.Draw(prompt_layer)

    prompt_cx = CENTER
    prompt_cy = enso_cy
    chevron_size = 130
    chevron_width = 22

    draw_brush_chevron(pd, prompt_cx - 30, prompt_cy, chevron_size, chevron_width, PRIMARY)
    draw_brush_cursor(pd, prompt_cx + 80, prompt_cy, chevron_size * 0.85, chevron_width * 0.8, PRIMARY)

    # Slight blur for ink feel
    prompt_soft = prompt_layer.filter(ImageFilter.GaussianBlur(radius=0.8))
    img = Image.alpha_composite(img, prompt_soft)
    img = Image.alpha_composite(img, prompt_layer)

    return img


def create_splash():
    img = Image.new('RGBA', (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)

    enso_cy = CENTER - 70
    enso_radius = 210
    enso_width = 44

    # Enso
    enso_layer = draw_enso_layer(SIZE, CENTER, enso_cy, enso_radius, enso_width, TEXT)
    enso_soft = enso_layer.filter(ImageFilter.GaussianBlur(radius=1.2))
    img = Image.alpha_composite(img, enso_soft)
    img = Image.alpha_composite(img, enso_layer)

    # Brush prompt
    prompt_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    pd = ImageDraw.Draw(prompt_layer)

    draw_brush_chevron(pd, CENTER - 25, enso_cy, 100, 18, PRIMARY)
    draw_brush_cursor(pd, CENTER + 60, enso_cy, 85, 15, PRIMARY)

    prompt_soft = prompt_layer.filter(ImageFilter.GaussianBlur(radius=0.6))
    img = Image.alpha_composite(img, prompt_soft)
    img = Image.alpha_composite(img, prompt_layer)

    draw = ImageDraw.Draw(img)

    # "ZenTerm" text
    name_font = get_sans_font(68)
    name = "ZenTerm"
    nb = draw.textbbox((0, 0), name, font=name_font)
    nw = nb[2] - nb[0]
    nx = CENTER - nw // 2
    ny = enso_cy + enso_radius + 70
    draw.text((nx, ny), name, font=name_font, fill=TEXT_SEC)

    return img


def save_png(img, path):
    if img.mode == 'RGBA':
        rgb = Image.new('RGB', img.size, BG)
        rgb.paste(img, mask=img.split()[3])
        rgb.save(path, 'PNG')
    else:
        img.save(path, 'PNG')
    print(f"Saved: {path}")


def main():
    icon = create_icon()
    splash = create_splash()

    base = "/home/raspi5/projects/zenterm/packages/mobile/assets/images"
    save_png(icon, f"{base}/icon.png")
    save_png(icon, "/home/raspi5/projects/zenterm/icon-preview.png")
    save_png(splash, f"{base}/splash-icon.png")
    save_png(splash, "/home/raspi5/projects/zenterm/splash-preview.png")


if __name__ == "__main__":
    main()
