"""Builds the two in-app ad banners shown in the member app plates, so the
phone screens in the video show a live platform promo and a club competition
instead of the empty "Ad Space" placeholder.

    python3 marketing/club-explainer-video/make-ad-banners.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
FONTS = HERE / "assets" / "fonts"
IMG = HERE / "assets" / "img"
OUT = HERE / "assets" / "ads"
OUT.mkdir(parents=True, exist_ok=True)

DARK_GREEN = (31, 66, 52)
CLUB_GREEN = (0, 128, 90)
LIME = (205, 222, 92)
WHITE = (255, 255, 255)
W, H = 1200, 600


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def pill(draw, xy, text, fnt, fill, fg):
    x, y = xy
    l, t, r, b = draw.textbbox((0, 0), text, font=fnt)
    pad_x, pad_y = 28, 14
    draw.rounded_rectangle((x, y, x + (r - l) + pad_x * 2, y + (b - t) + pad_y * 2), radius=40, fill=fill)
    draw.text((x + pad_x - l, y + pad_y - t), text, font=fnt, fill=fg)


def platform_promo():
    im = Image.new("RGB", (W, H), DARK_GREEN)
    glow = Image.new("RGB", (W, H), DARK_GREEN)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((650, -250, 1500, 600), fill=CLUB_GREEN)
    im = Image.blend(im, glow.filter(ImageFilter.GaussianBlur(160)), 0.85)
    d = ImageDraw.Draw(im)
    pill(d, (70, 70), "FLAGRR PROMO  ·  EVERY PARTNER CLUB", font("Poppins_600SemiBold.ttf", 30), LIME, DARK_GREEN)
    d.text((70, 175), "Double Flagrr Cash", font=font("Fraunces_700Bold.ttf", 104), fill=WHITE)
    d.text((70, 300), "Weekend", font=font("Fraunces_700Bold.ttf", 104), fill=LIME)
    d.text((72, 460), "Every receipt at your club earns 2x, Sat and Sun.", font=font("Poppins_500Medium.ttf", 36), fill=(214, 228, 220))
    im.save(OUT / "ad-platform-promo.png")


def club_competition():
    photo = Image.open(IMG / "strand-golf-club-fairway.jpg").convert("RGB")
    scale = W / photo.width
    photo = photo.resize((W, int(photo.height * scale)))
    top = (photo.height - H) // 2
    im = photo.crop((0, top, W, top + H))
    shade = Image.new("RGB", (W, H), DARK_GREEN)
    mask = Image.linear_gradient("L").rotate(90).resize((W, H))
    im = Image.composite(im, shade, mask.point(lambda v: int(v * 0.75)))
    d = ImageDraw.Draw(im)
    pill(d, (70, 70), "STRAND GOLF CLUB  ·  COMPETITION", font("Poppins_600SemiBold.ttf", 30), LIME, DARK_GREEN)
    d.text((70, 180), "October Medal", font=font("Fraunces_700Bold.ttf", 108), fill=WHITE)
    d.text((72, 330), "Enter at the pro shop.", font=font("Poppins_500Medium.ttf", 40), fill=WHITE)
    d.text((72, 385), "Every entry earns 200 Flagrr Cash.", font=font("Poppins_500Medium.ttf", 40), fill=LIME)
    im.save(OUT / "ad-club-competition.png")


platform_promo()
club_competition()
print("wrote", *sorted(p.name for p in OUT.iterdir()))
