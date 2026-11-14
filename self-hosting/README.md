# Self-hosting Kasana

This guide runs **[Kasana](https://github.com/man612/Kasana)**, an independent MoneyMatter-based application, on your own machine or server.

> **Important:** The base Compose file intentionally references non-pullable placeholder tags for the frontend and backend. Running it without both Kasana overlays **must fail**, rather than starting another project's application. The currency-rates helper remains an explicitly declared upstream-derived third-party image; it is not the Kasana finance backend or frontend.

## How the Compose files fit together

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Shared service definitions and dependencies; fails closed without built Kasana images |
| `docker-compose.build.yml` | Builds frontend and backend **from Kasana source** |
| `docker-compose.private.yml` | Keeps Kasana's image tags and Docker resources separate from upstream |

Use all three files together. The `pull_policy: never` guard for Kasana frontend/backend prevents automatic registry pulls; `up --build` explicitly builds both from source.

For bundled HTTPS via Traefik, append `-f docker-compose.traefik.yml` after these three files, and set both `LETSENCRYPT_EMAIL` and `SELFHOST_FRONTEND_DOMAIN`. Leave `MCP_BASE_URL` unset unless you intend to publish an MCP/OAuth endpoint; configuring just the application's login URL must not advertise an untested MCP service. The Traefik proxy uses the historical Docker network `moneymatter-private-net`; do not rename that network on an existing installation without a migration.

## Linux / VPS quickstart

Install Docker Engine with the Compose plugin, then:

```bash
git clone https://github.com/man612/Kasana.git
cd Kasana/self-hosting
cp .env.example .env
# Edit .env and replace all __REPLACE_ME__ placeholders.
# For a public server, configure your real HTTPS origin.
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml ps
```

For local testing, open `http://localhost:8080` when using the default port. For an internet-facing server, use HTTPS behind a reverse proxy or Cloudflare Tunnel. Configure `BETTER_AUTH_URL`, `AUTH_ORIGIN`, and reverse-proxy headers for the actual origin. Keep database and Redis ports off public interfaces.

A build from source can need substantially more RAM and storage than pulling prebuilt images. See [Windows/VPS setup notes](../docs/LOCAL-VPS-ID.md) for practical checks and resource caveats.

## Windows / Docker Desktop

From the repository root in PowerShell:

```powershell
.\scripts\setup-local-private.ps1
.\scripts\run-local-private.ps1
.\scripts\verify-local-private.ps1
```

The `-private` script names are historical; they still build the public Kasana repository from source. These scripts are designed for local development. Do not reuse freshly generated local credentials to overwrite credentials from an existing deployment.

## Preserving existing data

The `docker-compose.private.yml` overlay deliberately retains the legacy project name `moneymatter-private`, network `moneymatter-private-net`, and local image tags `moneymatter-private-*`. These are **Docker identifiers**, not the GitHub repository name.

Changing the Compose project name without a migration creates a different resource namespace. An existing database may look empty simply because a **new volume** has been mounted.

- Do not run `docker compose down -v` against a data-bearing instance.
- Back up PostgreSQL, attachments, and secrets, then verify a restore in an isolated environment.
- CI executes [a disposable PostgreSQL and attachments backup/restore smoke test](tests/backup-restore-synthetic.sh) using **synthetic data**. This verifies basic `pg_dump`/gzip/`psql` and `tar` mechanics but **does not back up or restore your actual VPS**. Before production, separately test backup integrity, operator secret recovery, restored login, migrations, and every configured attachment storage backend.
- Audit login, sessions, OAuth redirects, and HTTPS before exposing the app publicly.
- Kasana has **no verified production auto-deployment**; inherited upstream deploy and backup workflows have been guarded against running here.

## Further documentation

- [Kasana project overview](../README.md)
- [Windows/VPS notes](../docs/LOCAL-VPS-ID.md)
- [Environment variable reference](docs/environment-reference.md) — inherited reference; verify values for Kasana
- [Reverse proxy recipes](docs/reverse-proxies.md) and [Traefik overlay](docs/traefik-overlay.md)
- [Upstream-derived setup guide](docs/setup-guide.md) — architecture reference, **not** the default Kasana launch command
- [Report a problem](https://github.com/man612/Kasana/issues)

See [LICENSE](../LICENSE) and [LICENSING.md](../LICENSING.md) for licensing and upstream attribution.
