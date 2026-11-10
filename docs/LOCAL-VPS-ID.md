# Kasana — Panduan lokal Windows dan VPS (Indonesia-first)

Independent GitHub repository created from MoneyMatter upstream release **v0.33.14**
(commit `a7ed310634ba3148d0c2b876fd051be11bc9ec04`).
Upstream: https://github.com/letehaha/moneymatter
License: **AGPL-3.0-only**, preserved in `LICENSE` and `LICENSING.md`.
This project is not represented as original software and must preserve upstream notices.

## Modifikasi Indonesia (baseline)

- New-user onboarding prioritizes **IDR**, preselected when the currency catalogue is loaded; user can choose another currency.
- First visit starts in **Bahasa Indonesia**; the language chosen later in Settings takes precedence. Missing translation keys still fall back to English.
- Initial number formatting follows **id-ID** (thousands separated by dots, decimals by commas). Money amounts are not modified. The original application may show fractional rupiah depending on its currency display settings.
- No DB-wide forced currency conversion or modification of existing user preferences.
- Other currencies, investments, historical exchange rates and multicurrency features remain untouched.
- This is an app UI default only; no claim of automatic sync support for Indonesian banks.

## Windows: first local run

1. Install **Docker Desktop** and enable the **WSL 2 Linux container backend**. Start Docker Desktop and verify `docker version` and `docker compose version`.
2. Open PowerShell in the repository directory.
3. Run `.\scripts\setup-local-private.ps1` once. It generates random secrets in gitignored `self-hosting/.env`, caps signups at one for initial testing, and binds the frontend to `127.0.0.1:8080`.
4. Run `.\scripts\run-local-private.ps1`. This builds the backend/frontend from **this repository's source**, not the upstream published application images.
5. Run `.\scripts\verify-local-private.ps1` to confirm container health and that the sign-in page returns HTTP 200. This test never registers a user or changes financial data.
6. Visit http://localhost:8080; register the first user and verify onboarding preselects IDR.
7. Use Settings to choose any other base currency if necessary **before** importing real data. Existing data is not automatically converted by the UI default.

Note: source builds are resource intensive. This Windows machine has ~12 GB RAM; the generated env sets `NODE_BUILD_HEAP_MB=4096`. Increase Docker/WSL available RAM if the frontend build fails. Upstream dev source may require Node 24.22.1, but the production Dockerfiles already pin that version.

Never run `docker compose down -v` on an instance with real data. It deletes persistent named volumes.

## VPS: same containers, separate production secrets

Use Ubuntu 24.04 LTS with Docker Engine and the Compose plugin. A 4 GB RAM VPS is a reasonable *runtime test* starting point; building the full frontend there may need 8–12 GB or a separate CI builder. No verified real-world benchmark has been performed.

1. Clone repository publik Kasana ke VPS: `git clone https://github.com/man612/Kasana.git` (bukan repo upstream). Source publik tidak membuat `.env` maupun data VPS publik.
2. In `self-hosting/`, copy `.env.example` to `.env` and replace the **four** `__REPLACE_ME__` placeholders with independent cryptographically random values. Do not reuse local secrets when creating a fresh empty database; if moving existing accounts, carefully preserve the original authentication secrets.
3. Set `BETTER_AUTH_URL` and `AUTH_ORIGIN` to exactly the same external HTTPS URL, e.g. `https://finance.example.com`.
4. Set `HTTP_PORT=127.0.0.1:8080` and `SYSTEM_MAX_SIGNUPS_ALLOWED=1` for a single-user private instance. Do not expose PostgreSQL or Redis to public interfaces.
5. Run from `self-hosting/`:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml ps
```

6. Put HTTPS in front with a reverse proxy or a **Cloudflare Tunnel**, routing `finance.example.com` to `http://localhost:8080`. For Tunnel, preserve correct origin and proxy headers; test login, cookies, CSRF and OAuth redirects.
7. Disable public caching of authenticated pages/API responses, set monitoring and backups, and verify database and attachments restoration before entering financial data.

### Upgrades, backups, and security

- Keep `self-hosting/.env` secret and out of Git. Never commit API keys, database dumps, exported transactions, or private attachment files.
- Database is in Docker volume `db_data`; attachments are in `attachments_data`. Both are required for a complete migration or restore.
- Example PostgreSQL backup on the VPS (from `self-hosting/` after the containers are running):

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > kasana-backup.sql
```

  Treat this SQL as sensitive personal financial information and encrypt it before off-site storage. Back up attachments and environment secrets separately using access controls.

- Do not blindly `git pull` development branch or switch database versions; test migrations and data restoration against a staging copy.
- The upstream main repository's release tags and security advisories should be monitored. Because this copy is independent, there is no automatic upstream merge or fork badge.
- AGPL-3.0 requires preserving legal notices, and a modified network service must offer the corresponding source to its network users under the license's terms. Penuhi kewajiban lisensi yang berlaku pada setiap deployment; repo Kasana sekarang publik.

## Acceptance checks

- Compose validates and all five containers become healthy.
- Browser loads, a test account registers, and **IDR** is the initial base currency.
- Indonesian UI loads and an explicit language preference survives refresh.
- Add a Rp1,000,000 account; record Rp125,000 expense; expected remaining balance Rp875,000 (ignoring unrelated transactions).
- Export/restore a test database and check that recurring transactions, attachments, and investment figures remain consistent.
- Check external HTTPS, login session, logout, API health and MCP separately before public deployment.
