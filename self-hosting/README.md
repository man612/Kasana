# Self-hosting Lajur.

This guide runs **[Lajur.](https://github.com/man612/Kasana)**, an independent MoneyMatter-based application, on your own machine or server.

> **Important:** The base Compose file intentionally references non-pullable placeholder tags for the frontend and backend. Running it without both Lajur. overlays **must fail**, rather than starting another project's application. The currency-rates helper remains an explicitly declared upstream-derived third-party image; it is not the Lajur. finance backend or frontend.

## How the Compose files fit together

| File                         | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `docker-compose.yml`         | Shared service definitions and dependencies; fails closed without built Lajur. images |
| `docker-compose.build.yml`   | Builds frontend and backend **from Lajur. source**                                    |
| `docker-compose.private.yml` | Keeps Lajur. image tags and Docker resources separate from upstream                   |

Use all three files together. The `pull_policy: never` guard for Lajur. frontend/backend prevents automatic registry pulls; `up --build` explicitly builds both from source.

For bundled HTTPS via Traefik, append `-f docker-compose.traefik.yml` after these three files, and set both `LETSENCRYPT_EMAIL` and `SELFHOST_FRONTEND_DOMAIN`. Leave `MCP_BASE_URL` unset unless you intend to publish an MCP/OAuth endpoint; configuring just the application's login URL must not advertise an untested MCP service. The Traefik proxy uses the historical Docker network `moneymatter-private-net`; do not rename that network on an existing installation without a migration.

## Linux / VPS quickstart

Install Docker Engine with the Compose v2 plugin. The example checks out the **temporary integration-rehearsal branch**, not a released `main` version. Review its CI before use, then:

```bash
git clone --branch integration/lajur-release-candidate-20261115 --single-branch https://github.com/man612/Kasana.git
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

## Windows / Podman (preferred) or Docker

Install **PowerShell 7.2+**, Podman with a running Linux machine, and **Docker Compose v2** as its external Compose provider. Docker Engine/Desktop with its Compose plugin is also supported (`-Engine Docker`). See the [runtime preflight and storage cautions](../docs/LOCAL-VPS-ID.md).

From the repository root in PowerShell 7 (`pwsh`):

```powershell
.\scripts\setup-local-private.ps1
.\scripts\run-local-private.ps1 -Engine Podman -ValidateOnly
.\scripts\run-local-private.ps1 -Engine Podman
.\scripts\verify-local-private.ps1 -Engine Podman
```

The `-private` script names are historical; they still build the public Lajur. repository from source. These scripts are designed for local development. Do not reuse freshly generated local credentials to overwrite credentials from an existing deployment.

## Preserving existing data

The `docker-compose.private.yml` overlay deliberately retains the legacy project name `moneymatter-private`, network `moneymatter-private-net`, and local image tags `moneymatter-private-*`. These are **container compatibility identifiers**, not the GitHub repository name.

Changing the Compose project name without a migration creates a different resource namespace. An existing database may look empty simply because a **new volume** has been mounted.

- Do not run `docker compose down -v` against a data-bearing instance.
- Back up PostgreSQL, attachments, and secrets, then verify a restore in an isolated environment.
- The opt-in Linux VPS [encrypted Restic/B2 off-site backup runbook](docs/offsite-backup-restic.md) and [operator script](../scripts/backup-offsite.sh) are provided for review. They never auto-run, touch production databases, or bypass explicit maintenance confirmation. The [synthetic encrypted restore test](tests/offsite-restic-synthetic.sh) is independent of the existing synthetic SQL/gzip smoke. Production B2 credentials, R2 exports, scheduling and operator restore sign-off remain pending.
- CI executes [a disposable PostgreSQL and attachments backup/restore smoke test](tests/backup-restore-synthetic.sh) using **synthetic data**. This verifies basic `pg_dump`/gzip/`psql` and `tar` mechanics but **does not back up or restore your actual VPS**. Before production, separately test backup integrity, operator secret recovery, restored login, migrations, and every configured attachment storage backend.
- Audit login, sessions, OAuth redirects, and HTTPS before exposing the app publicly.
- Lajur. has **no verified production auto-deployment**; inherited upstream deploy and backup workflows have been guarded against running here.

## Further documentation

- [Lajur. project overview](../README.md)
- [Windows/VPS notes](../docs/LOCAL-VPS-ID.md)
- [Environment variable reference](docs/environment-reference.md) — inherited reference; verify values for Lajur.
- [Reverse proxy recipes](docs/reverse-proxies.md) and [Traefik overlay](docs/traefik-overlay.md)
- [Upstream-derived setup guide](docs/setup-guide.md) — architecture reference, **not** the default Lajur. launch command
- [Report a problem](https://github.com/man612/Kasana/issues)

See [LICENSE](../LICENSE) and [LICENSING.md](../LICENSING.md) for licensing and upstream attribution.
