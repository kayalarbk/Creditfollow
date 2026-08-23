"""
KartPanel logo/ikon üretici (geliştirici aracı — çalışma zamanında kullanılmaz).

Kullanım:  python tools/generate-icons.py
Gereksinim: Pillow

Ürettikleri (assets/icons/):
  icon-192.png, icon-512.png        — PWA standart ikonlar (any)
  maskable-192.png, maskable-512.png— maskable (güvenli alan %80)
  apple-touch-icon.png (180)        — iOS ana ekran
  favicon-32.png, favicon-16.png    — tarayıcı sekmesi
  og-image.png (1200x630)           — paylaşım görseli
Marka: iki katmanlı kart + yükselen mini grafik, #0A84FF → #5E5CE6 gradyan.
"""
from PIL import Image, ImageDraw
import os, math

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
os.makedirs(OUT, exist_ok=True)

ACCENT = (10, 132, 255)
INDIGO = (94, 92, 230)
SS = 4  # supersampling


def gradient(size, c1, c2):
    """Sol-üstten sağ-alta doğrusal gradyan."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return img


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def card_layer(size, w, h, r, fill, stripe=None, bars=None):
    """Şeffaf katman üzerine tek kart çizer; katman döndürülebilsin diye ayrı."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0 = (size - w) / 2, (size - h) / 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=r, fill=fill)
    if stripe:
        sh = h * 0.14
        sy = y0 + h * 0.20
        d.rounded_rectangle([x0 + w * 0.10, sy, x0 + w * 0.44, sy + sh],
                            radius=sh / 2, fill=stripe)
    if bars:
        # sol altta yükselen üç sütun
        bw, gap = w * 0.105, w * 0.055
        base = y0 + h * 0.80
        bx = x0 + w * 0.12
        for hf in (0.22, 0.34, 0.46):
            d.rounded_rectangle([bx, base - h * hf, bx + bw, base], radius=bw * 0.4, fill=bars)
            bx += bw + gap
        # sağ üstte yükseliş oku (sütunlarla kesişmez)
        tip = (x0 + w * 0.86, y0 + h * 0.30)
        tail = (x0 + w * 0.62, y0 + h * 0.54)
        lw = max(2, int(w * 0.045))
        d.line([tail, tip], fill=bars, width=lw)
        a = w * 0.17  # ok başı kenar uzunluğu
        d.polygon([tip, (tip[0] - a, tip[1]), (tip[0], tip[1] + a)], fill=bars)
    return layer


def logo(px, pad_ratio=0.0, transparent_bg=False, radius_ratio=0.2237):
    """Tam ikon üretir. pad_ratio: maskable güvenli alan için içe boşluk."""
    size = px * SS
    if transparent_bg:
        base = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    else:
        bg = gradient(size, ACCENT, INDIGO).convert('RGBA')
        bg.putalpha(rounded_mask(size, int(size * radius_ratio)))
        base = bg

    inner = size * (1 - 2 * pad_ratio)
    off = (size - inner) / 2

    # arka kart (yarı saydam), öne göre kaydırılmış
    back = card_layer(size, inner * 0.62, inner * 0.40, inner * 0.055, (255, 255, 255, 110))
    back = back.rotate(-15, resample=Image.BICUBIC)
    base.alpha_composite(back, (0, int(-inner * 0.115)))

    front = card_layer(size, inner * 0.66, inner * 0.43, inner * 0.06,
                       (255, 255, 255, 255), stripe=(214, 226, 245, 255), bars=ACCENT + (255,))
    front = front.rotate(-15, resample=Image.BICUBIC)
    base.alpha_composite(front, (0, int(inner * 0.075)))

    return base.resize((px, px), Image.LANCZOS)


def save(img, name):
    img.save(os.path.join(OUT, name), optimize=True)
    print('  ✓', name)


print('İkonlar üretiliyor →', os.path.normpath(OUT))
save(logo(512), 'icon-512.png')
save(logo(192), 'icon-192.png')
# maskable: köşeleri işletim sistemi kırpar → zemin tam kare, marka %80 güvenli alanda
save(logo(512, pad_ratio=0.14, radius_ratio=0.0), 'maskable-512.png')
save(logo(192, pad_ratio=0.14, radius_ratio=0.0), 'maskable-192.png')
save(logo(180), 'apple-touch-icon.png')
save(logo(32), 'favicon-32.png')
save(logo(16), 'favicon-16.png')

# OG görseli: gradyan zemin + ortada logo
og = gradient(630, ACCENT, INDIGO).convert('RGBA').resize((1200, 630))
mark = logo(360, transparent_bg=True)
og.alpha_composite(mark, (420, 135))
og.convert('RGB').save(os.path.join(OUT, 'og-image.png'), optimize=True)
print('  ✓ og-image.png')
