# Self-hosting Kasana

This guide runs **[Kasana](https://github.com/man612/Kasana)**, an independent MoneyMatter-based application, on your own machine or server.

> **Important:** Docker images tagged `letehaha/budget-tracker-*` belong to MoneyMatter upstream, **not Kasana**. Do not launch only the base Compose file and assume it contains Kasana changes.

## How the Compose files fit together

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Inherited service definitions, PostgreSQL, Redis, and networking |
| `docker-compose.build.yml` | Builds frontend and backend **from Kasana source** |
| `docker-compose.private.yml` | Keeps Kasana's image tags and Docker resources separate from upstream |

Use all three files together.

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
