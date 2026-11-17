# Branding — Lajur.

The app display name is Lajur., including the final period.

The canonical display-name configuration is [`packages/frontend/branding.json`](../packages/frontend/branding.json). Change its name,
shortName and description properties. Run:

    npm -w budget-tracker-fe run branding:sync

Or run the frontend build; the prebuild hook performs the same sync. The
lastSyncedName entry is owned by the script and should not be edited manually.
The [`packages/frontend/src/common/brand.ts`](../packages/frontend/src/common/brand.ts) module reads the same JSON at runtime.
The sync script also updates browser title, PWA manifest, translated display
strings and user-facing informational pages.

These are DISPLAY names only. Do not rename cookie/localStorage identifiers,
database tables, Docker volumes, API routes, file paths, public GitHub URLs,
or historical copyright/license references.

For future authorized artwork updates, the tracked source is
[`packages/frontend/assets/app-icon-source.png`](../packages/frontend/assets/app-icon-source.png). Preserve the current S-curve artwork during repository hygiene.

Use a square PNG at least 512x512. Then regenerate all browser/PWA icons:

    python -m pip install Pillow
    python packages/frontend/scripts/generate-brand-icons.py

The generated assets include multi-resolution favicon.ico, favicon.svg (a
self-contained raster wrapper), PNG favicon, Apple touch, PWA 192/512 and
maskable icons. Maskable versions use a neutral opaque background and safe area.
Commit the assets; CI does not require Pillow. The icon generator also refreshes all five shared SVG logo locations in `docs/brand/`, `packages/frontend/public/img/`, `packages/landing/public/img/`, and `packages/docs/` from the same generated favicon. The `check-public-identity.mjs` CI check rejects any stale or mismatched copies.

The repository retains the historical `Kasana` slug for link continuity. Copyright and AGPL attribution for MoneyMatter are preserved independently of branding.

The old MoneyMatter-specific `docs/brand/generate-logo.py` was retired because it recreated the former icon and could overwrite the new browser/landing assets. **Do not regenerate branding from any historical M- or K-shaped logo.** The canonical maintained source is the S-curve PNG above. The copies in `docs/brand/logo.svg`, `packages/frontend/public/img/logo.svg`, `packages/landing/public/img/logo.svg`, and the inherited docs package now reuse the committed Lajur. favicon artwork.

## Icon provenance and permissions

The canonical S-curve PNG first appears in this repository in commit `5ce43a7228a6ecc1e6476c4943be3ff3890a3d0b` (12 November 2026), with the branding generator and derived browser assets. The commit establishes repository history, **not proof of authorship or permission**. No original artist, source URL, separate artwork license, or permission record was found in the tracked branding material. The code license alone does not establish rights in third-party artwork or trademarks.

Preserve the committed PNG and synchronized copies. Before representing the icon as owned or separately licensed, obtain and record the original source/creator and applicable license or permission. Do not invent an attribution, assert exclusive rights, or substitute arbitrary artwork. [LICENSING.md](../LICENSING.md) covers the code and upstream records; artwork provenance remains unresolved.
