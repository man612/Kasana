# Lajur. — Windows and VPS Setup Guide

Independent GitHub repository created from MoneyMatter upstream release **v0.33.14**
(commit `a7ed310634ba3148d0c2b876fd051be11bc9ec04`).
Upstream: https://github.com/letehaha/moneymatter
License: **AGPL-3.0-only**, preserved in `LICENSE` and `LICENSING.md`.
This project is not represented as original software and must preserve upstream notices.

## Indonesia-first defaults

- New-user onboarding prioritizes **IDR**, preselected when the currency catalogue is loaded; user can choose another currency.
- First visit starts in **Bahasa Indonesia**; the language chosen later in Settings takes precedence. Missing translation keys still fall back to English.
- Initial number formatting follows **id-ID** (thousands separated by dots, decimals by commas). Money amounts are not modified. The original application may show fractional rupiah depending on its currency display settings.
- No DB-wide forced currency conversion or modification of existing user preferences.
- Other currencies, investments, historical exchange rates and multicurrency features remain untouched.
- This is an app UI default only; no claim of automatic sync support for Indonesian banks.

## Windows: runtime and provider preflight

Use **PowerShell 7.2+** (`pwsh`), not Windows PowerShell 5.1. The setup script uses modern .NET cryptographic APIs.

Podman is preferred for local Windows work. Install Podman and Docker Compose v2 (the standalone `docker-compose` executable or a provider configured through `PODMAN_COMPOSE_PROVIDER`). **`podman compose` delegates to an external provider**; Podman alone does not include Compose. This stack requires modern Compose features, including optional `env_file` entries and `pull_policy`; the scripts validate the merged configuration to reject unsupported providers.

Run these read-only checks first:

```powershell
podman --version
podman machine list
podman info
podman compose version
```

If there is no machine, initialize one with `podman machine init`. If stopped, start your selected machine with `podman machine start <name>`; the scripts never initialize or start machines automatically. With multiple machines/connections, confirm `podman system connection list` points at the intended one. For Docker, start Docker Desktop with Linux containers/WSL 2 and check `docker info` and `docker compose version`.

Both run and verify scripts accept `-Engine Podman`, `-Engine Docker`, or `-Engine Auto` (default). Auto prefers the installed Podman CLI, then Docker. Once selected, preflight failure stops execution; it does not silently switch to another engine's empty storage. Explicit selection is recommended for an existing installation.

Podman machines and Docker daemons have **separate images, volumes, networks and credentials**. Matching project/volume names do not migrate data between them. Preserve `moneymatter-private`, `moneymatter-private-net`, local image tags and named volumes. Use the engine and connection that own your installation; any migration requires a separately verified backup/restore procedure.

## Windows: first local run

1. Complete the runtime/provider preflight above. Check out `integration/lajur-release-candidate-20261115` for these unmerged scripts; the feature baseline is `feat/lajur-finance-ux-dashboard-accounts-loans-20261114`, not `main`. Review current PR status before deployment.
2. Open PowerShell 7 in the repository directory.
3. Run `.\scripts\setup-local-private.ps1` once. It generates random secrets in gitignored `self-hosting/.env`, caps signups at one for initial testing, and binds the frontend to `127.0.0.1:8080`.
4. Run `.\scripts\run-local-private.ps1 -Engine Podman -ValidateOnly`, then `.\scripts\run-local-private.ps1 -Engine Podman`. This builds the backend/frontend from **this repository's source**, not the upstream published application images.
5. Run `.\scripts\verify-local-private.ps1 -Engine Podman` to confirm container health and that the sign-in page returns HTTP 200. This test never registers a user or changes financial data.
6. Visit http://localhost:8080; register the first user and verify onboarding preselects IDR.
7. Use Settings to choose any other base currency if necessary **before** importing real data. Existing data is not automatically converted by the UI default.

Source builds are resource intensive. The generated env caps the Node heap at `NODE_BUILD_HEAP_MB=4096`; the runtime needs additional memory for other build processes and services. Adjust the selected Podman machine or Docker/WSL memory budget for your hardware. The production Dockerfiles pin Node 24.22.1.

`-ValidateOnly` checks runtime availability, the Compose provider and merged configuration without building or starting containers. The verifier is read-only: it checks five running services, requires healthy checks on db/redis/rates/backend, and checks the frontend sign-in page by HTTP (the frontend has no container healthcheck). Starting or unhealthy services fail verification; wait and rerun. With a custom port, pass `-BaseUri http://127.0.0.1:<port>`. Configuration validation is not proof of a successful Podman build or browser flow.

Never run `docker compose down -v` on an instance with real data. It deletes persistent named volumes.

## VPS: same containers, separate production secrets

Use Ubuntu 24.04 LTS with Docker Engine and the Compose plugin. A 4 GB RAM VPS is a reasonable _runtime test_ starting point; building the full frontend there may need 8–12 GB or a separate CI builder. No verified real-world benchmark has been performed.

1. Clone the **public Lajur. source repository** (GitHub slug `man612/Kasana`) at the reviewed development branch: `git clone --branch integration/lajur-release-candidate-20261115 --single-branch https://github.com/man612/Kasana.git`. This branch is unmerged development work, not a production release or MoneyMatter upstream. Public source does not expose private server data or `.env` files.
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
- Database and attachments use Compose volume keys `db_data` and `attachments_data` (engine-local names are normally prefixed `moneymatter-private_`; attachments may use a configured bind mount or object storage). Both are required for a complete migration or restore.
- Example PostgreSQL backup on the VPS (from `self-hosting/` after the containers are running):

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > lajur-backup.sql
```

Treat this SQL as sensitive personal financial information and encrypt it before off-site storage. Back up attachments and environment secrets separately using access controls.

- Do not blindly `git pull` development branch or switch database versions; test migrations and data restoration against a staging copy.
- The upstream main repository's release tags and security advisories should be monitored. Because this copy is independent, there is no automatic upstream merge or fork badge.
- AGPL-3.0 requires preserving legal notices, and a modified network service must offer the corresponding source to its network users under the license's terms. The Lajur. source repository is public, but each deployment must still comply with the applicable license obligations.

## Acceptance checks

- Compose validates; all five services run, the four configured container healthchecks pass, and frontend HTTP responds.
- Browser loads, a test account registers, and **IDR** is the initial base currency.
- Indonesian UI loads and an explicit language preference survives refresh.
- Add a Rp1,000,000 account; record Rp125,000 expense; expected remaining balance Rp875,000 (ignoring unrelated transactions).
- Export/restore a test database and check that recurring transactions, attachments, and investment figures remain consistent.
- Check external HTTPS, login session, logout, API health and MCP separately before public deployment.
