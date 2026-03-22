#!/usr/bin/env python3
"""Generate zenterm app icon — clean palm silhouette + bold terminal prompt."""

from PIL import Image, ImageDraw, ImageFont
import math

SIZE = 1024
CENTER = SIZE // 2


def pill(draw, x1, y1, x2, y2, width, color):
    """Draw a pill/capsule shape between two points."""
    r = width // 2
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    draw.ellipse([x1 - r, y1 - r, x1 + r, y1 + r], fill=color)
    draw.ellipse([x2 - r, y2 - r, x2 + r, y2 + r], fill=color)


def create_icon():
    bg_color = (26, 25, 21)
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background
    draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=220, fill=bg_color)

    # Hand color - single clean tone, no distracting highlight
    hand = (200, 155, 75)

    # Palm center
    pcx, pcy = CENTER - 10, CENTER + 50

    # Fingers
    finger_data = [
        (pcx - 140, pcy - 55,  pcx - 170, pcy - 270, 58),   # pinky
        (pcx - 50,  pcy - 95,  pcx - 55,  pcy - 345, 62),   # ring
        (pcx + 30,  pcy - 105, pcx + 30,  pcy - 375, 64),   # middle
        (pcx + 115, pcy - 90,  pcx + 125, pcy - 330, 62),   # index
    ]
    for bx, by, tx, ty, w in finger_data:
        pill(draw, bx, by, tx, ty, w, hand)

    # Thumb
    pill(draw, pcx + 185, pcy - 10, pcx + 305, pcy - 140, 56, hand)

    # Palm body
    draw.ellipse([pcx - 225, pcy - 80, pcx + 225, pcy + 130], fill=hand)

    # Wrist
    draw.rounded_rectangle([pcx - 125, pcy + 100, pcx + 125, pcy + 210],
                           radius=45, fill=hand)

    # --- Dark rounded rectangle on palm = "terminal window" ---
    term_x1 = pcx - 150
    term_y1 = pcy - 60
    term_x2 = pcx + 160
    term_y2 = pcy + 80
    draw.rounded_rectangle([term_x1, term_y1, term_x2, term_y2],
                           radius=28, fill=bg_color)

    # Subtle border for terminal window
    draw.rounded_rectangle([term_x1, term_y1, term_x2, term_y2],
                           radius=28, outline=(60, 55, 45), width=3)

    # --- Terminal prompt ">" + cursor inside the terminal window ---
    font_size = 130
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", font_size)
    except (OSError, IOError):
        font = ImageFont.load_default()

    green = (110, 220, 155)
    win_cx = (term_x1 + term_x2) // 2
    win_cy = (term_y1 + term_y2) // 2

    # Draw ">" chevron
    chevron = ">"
    cb = draw.textbbox((0, 0), chevron, font=font)
    cw = cb[2] - cb[0]
    ch = cb[3] - cb[1]
    chev_x = win_cx - cw // 2 - 30
    chev_y = win_cy - ch // 2 - cb[1]  # compensate for font offset

    # Glow for chevron
    glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(14, 0, -2):
        a = int(12 * (1 - r / 14))
        for angle in range(0, 360, 45):
            dx = int(r * math.cos(math.radians(angle)))
            dy = int(r * math.sin(math.radians(angle)))
            gd.text((chev_x + dx, chev_y + dy), chevron, font=font, fill=(110, 220, 155, a))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    draw.text((chev_x, chev_y), chevron, font=font, fill=green)

    # Draw cursor as a simple rectangle (block cursor style)
    cursor_x = chev_x + cw + 20
    cursor_h = 100
    cursor_w = 16
    cursor_y = win_cy - cursor_h // 2
    draw.rounded_rectangle(
        [cursor_x, cursor_y, cursor_x + cursor_w, cursor_y + cursor_h],
        radius=4, fill=green
    )

    return img


def main():
    img = create_icon()
    out = "/home/raspi5/projects/zenterm/packages/mobile/assets/images/icon.png"
    preview = "/home/raspi5/projects/zenterm/icon-preview.png"
    rgb = Image.new('RGB', (SIZE, SIZE), (26, 25, 21))
    rgb.paste(img, mask=img.split()[3])
    rgb.save(out, 'PNG')
    rgb.save(preview, 'PNG')
    print(f"Done: {out}")


if __name__ == "__main__":
    main()
