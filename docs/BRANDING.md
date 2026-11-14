# Branding — Lajur.

The app display name is Lajur., including the final period.

The canonical source is packages/frontend/branding.json. Change its name,
shortName and description properties. Run:

    npm -w budget-tracker-fe run branding:sync

Or run the frontend build; the prebuild hook performs the same sync. The
lastSyncedName entry is owned by the script and should not be edited manually.
The shared src/common/brand.ts module reads the same JSON at runtime.
The sync script also updates browser title, PWA manifest, translated display
strings and user-facing informational pages.

These are DISPLAY names only. Do not rename cookie/localStorage identifiers,
database tables, Docker volumes, API routes, file paths, public GitHub URLs,
or historical copyright/license references.

To change the graphic, replace the tracked source file at:
    packages/frontend/assets/app-icon-source.png

Use a square PNG at least 512x512. Then regenerate all browser/PWA icons:

    python -m pip install Pillow
    python packages/frontend/scripts/generate-brand-icons.py

The generated assets include multi-resolution favicon.ico, favicon.svg (a
self-contained raster wrapper), PNG favicon, Apple touch, PWA 192/512 and
maskable icons. Maskable versions use a neutral opaque background and safe area.
Commit the assets; CI does not require Pillow.

The public repository still has the historical Kasana slug. MoneyMatter
copyright and AGPL attributions are preserved independently of app branding.
