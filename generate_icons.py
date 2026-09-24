"""Genera favicons e imagen para redes (og-image) a partir de los assets de marca.

Uso:
    pip install pillow
    python generate_icons.py [--bg "#78293c"] [--og-bg "#f4e7d7"]

Toma:
    src/assets/brand/isotipo-cream.png   -> icono (sobre círculo/cuadro del color --bg)
    src/assets/brand/logo-shop-wine.png  -> og-image.jpg (sobre fondo --og-bg)
"""
import argparse

from PIL import Image, ImageDraw


def hex_to_rgba(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def trim(img: Image.Image) -> Image.Image:
    return img.crop(img.getchannel("A").getbbox())


def icon(iso: Image.Image, size: int, bg, rounded: bool, pad: float = 0.22) -> Image.Image:
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    if rounded:
        draw.ellipse((0, 0, size - 1, size - 1), fill=bg)
    else:
        draw.rectangle((0, 0, size, size), fill=bg)
    h = int(size * (1 - 2 * pad))
    w = round(iso.width * h / iso.height)
    mark = iso.resize((w, h), Image.LANCZOS)
    base.paste(mark, ((size - w) // 2, (size - h) // 2), mark)
    return base


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bg", default="#78293c", help="color de fondo del icono")
    parser.add_argument("--og-bg", default="#f4e7d7", help="color de fondo de og-image")
    args = parser.parse_args()

    bg = hex_to_rgba(args.bg)
    iso = trim(Image.open("src/assets/brand/isotipo-cream.png").convert("RGBA"))

    for name, size, rounded in [
        ("favicon-16x16.png", 16, True),
        ("favicon-32x32.png", 32, True),
        ("apple-touch-icon.png", 180, False),
        ("android-chrome-192x192.png", 192, False),
        ("android-chrome-512x512.png", 512, False),
    ]:
        icon(iso, size, bg, rounded).save(f"public/{name}", optimize=True)
    icon(iso, 48, bg, True).save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    og = Image.new("RGBA", (1200, 630), hex_to_rgba(args.og_bg))
    logo = trim(Image.open("src/assets/brand/logo-shop-wine.png").convert("RGBA"))
    h = 300
    w = round(logo.width * h / logo.height)
    logo = logo.resize((w, h), Image.LANCZOS)
    og.paste(logo, ((1200 - w) // 2, (630 - h) // 2), logo)
    og.convert("RGB").save("public/og-image.jpg", quality=88)
    print("Iconos y og-image generados en public/")


if __name__ == "__main__":
    main()
