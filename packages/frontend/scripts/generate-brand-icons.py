#!/usr/bin/env python3
"""Generate favicon, Apple/PWA and maskable assets from assets/app-icon-source.png.

This script is intentionally opt-in; CI builds use the committed generated assets.
Install Pillow with: python -m pip install Pillow
"""
from pathlib import Path
import base64
import io
from PIL import Image, ImageDraw, ImageChops

frontend = Path(__file__).resolve().parent.parent
source = frontend / "assets/app-icon-source.png"
public = frontend / "public"
image = Image.open(source).convert("RGBA")
if image.width != image.height or image.width < 512:
    raise ValueError("Source icon must be square, at least 512x512.")

def resized(size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)

# A browser tab is typically only 16–32 pixels wide. The current source's
# white S-curve occupies ~45% of its full canvas, so preserve the original
# install icons but make a tighter, optically enlarged browser-only crop.
rgb = image.convert("RGB")
bright = rgb.convert("L").point(lambda value: 255 if value > 175 else 0)
visible = Image.composite(bright, Image.new("L", image.size), image.getchannel("A").point(lambda v: 255 if v > 150 else 0))
bounds = visible.getbbox()
if not bounds:
    raise ValueError("Source icon contains no bright visible foreground.")
left, top, right, bottom = bounds
center_x = (left + right) / 2
center_y = (top + bottom) / 2
side = int(max(right - left, bottom - top) * 1.42)
crop_box = (int(center_x - side / 2), int(center_y - side / 2), int(center_x + side / 2), int(center_y + side / 2))
browser_image = image.crop(crop_box)
def browser_resized(size: int) -> Image.Image:
    # Rounded square background with antialiased alpha corners, preserving logo
    # padding after the prior tightly cropped version clipped the favicon.
    img = browser_image.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * .22), fill=255)
    img.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return img

for size, name in [
    (96, "favicon-96x96.png"),
    (180, "apple-touch-icon.png"),
    (192, "web-app-manifest-192x192.png"),
    (512, "web-app-manifest-512x512.png"),
]:
    (browser_resized(size) if name.startswith("favicon") else resized(size)).save(public / name, optimize=True)

for size in (192, 512):
    background = Image.new("RGBA", (size, size), (245, 245, 245, 255))
    safe_size = int(size * 0.76)
    background.alpha_composite(
        resized(safe_size),
        ((size - safe_size) // 2, (size - safe_size) // 2),
    )
    background.convert("RGB").save(public / f"web-app-manifest-maskable-{size}x{size}.png", optimize=True)

browser_resized(256).save(
    public / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

buffer = io.BytesIO()
browser_resized(256).save(buffer, format="PNG", optimize=True)
encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
(public / "favicon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
    '<image width="256" height="256" href="data:image/png;base64,'
    + encoded + '"/></svg>\n',
    encoding="utf-8",
)
print("Generated browser + install icons from", source)
