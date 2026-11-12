#!/usr/bin/env python3
"""Generate favicon, Apple/PWA and maskable assets from assets/app-icon-source.png.

This script is intentionally opt-in; CI builds use the committed generated assets.
Install Pillow with: python -m pip install Pillow
"""
from pathlib import Path
import base64
import io
from PIL import Image

frontend = Path(__file__).resolve().parent.parent
source = frontend / "assets/app-icon-source.png"
public = frontend / "public"
image = Image.open(source).convert("RGBA")
if image.width != image.height or image.width < 512:
    raise ValueError("Source icon must be square, at least 512x512.")

def resized(size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)

for size, name in [
    (96, "favicon-96x96.png"),
    (180, "apple-touch-icon.png"),
    (192, "web-app-manifest-192x192.png"),
    (512, "web-app-manifest-512x512.png"),
]:
    resized(size).save(public / name, optimize=True)

for size in (192, 512):
    background = Image.new("RGBA", (size, size), (245, 245, 245, 255))
    safe_size = int(size * 0.76)
    background.alpha_composite(
        resized(safe_size),
        ((size - safe_size) // 2, (size - safe_size) // 2),
    )
    background.convert("RGB").save(public / f"web-app-manifest-maskable-{size}x{size}.png", optimize=True)

resized(256).save(
    public / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

buffer = io.BytesIO()
resized(256).save(buffer, format="PNG", optimize=True)
encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
(public / "favicon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
    '<image width="256" height="256" href="data:image/png;base64,'
    + encoded + '"/></svg>\n',
    encoding="utf-8",
)
print("Generated browser + install icons from", source)
