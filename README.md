<div align="center">

<img src="packages/frontend/public/web-app-manifest-192x192.png" width="88" alt="Lajur. icon">

# Lajur.

**A clearer view of your money.**

Open-source, self-hosted personal finance with an Indonesia-first experience.

[![CI](https://github.com/man612/Kasana/actions/workflows/check-source-code.yml/badge.svg?branch=main)](https://github.com/man612/Kasana/actions/workflows/check-source-code.yml)
[![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

[Get started](#getting-started) · [Self-hosting](self-hosting/README.md) · [Contribute](CONTRIBUTING.md) · [Issues](https://github.com/man612/Kasana/issues) · [Security](.github/SECURITY.md)

</div>

The app display name is **Lajur.** (period included). The GitHub repository still uses **Kasana** for link continuity. To rename the display again, see [branding instructions](docs/BRANDING.md). Original MoneyMatter attribution and AGPL-3.0 remain intact.

## Overview

**Lajur.** brings accounts, spending, budgets, and your wider financial picture into one place. It prioritizes Indonesian language and currency defaults while retaining the multi-currency capabilities of its upstream codebase.

Lajur. is an **independent adaptation** of [MoneyMatter](https://github.com/letehaha/moneymatter), initially based on **v0.33.14**. It is not an official MoneyMatter release, hosted service, or affiliated product. Original copyright notices and the [AGPL-3.0-only license](LICENSE) are preserved.

### What you can manage

- **Everyday finances:** accounts, transactions, categories, transfers, and data imports.
- **Planning:** budgets, recurring payments, and savings goals.
- **The bigger picture:** reports, investments, vehicles, loans, and net worth.
- **Multiple currencies:** Indonesian rupiah as a starting default for new users, without converting existing balances.

### Designed for Indonesia

- Bahasa Indonesia as the initial interface language; other supported languages remain available.
- IDR-first onboarding and Indonesian-style number formatting.
- Improvements to manual account management and everyday expense tracking.

> **Current limitations:** Indonesia-first does **not** mean automatic integration with Indonesian banks or e-wallets. Some inherited UI, translations, and workflows still need review. The latest interface changes are under review in [PR #10](https://github.com/man612/Kasana/pull/10) and may not yet exist on `main`.

## Getting started

Build Lajur. **from this repository's source**. The base Compose file uses intentionally non-pullable placeholder images for the finance frontend and backend; it is **not** a standalone deployment. Always combine the base, build, and private-instance overlays as shown below.

**Prerequisites:** Git, Docker Engine or Docker Desktop, Docker Compose, and sufficient memory and storage for a frontend source build.

### Linux / VPS

```bash
git clone https://github.com/man612/Kasana.git
cd Kasana/self-hosting
cp .env.example .env
# Edit .env: replace every __REPLACE_ME__ placeholder.
# For a public server, configure your actual HTTPS origin.
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml ps
```

For a local test installation with the default port, open `http://localhost:8080`. Read the [self-hosting guide](self-hosting/README.md) and [Windows/VPS setup notes](docs/LOCAL-VPS-ID.md) before deploying.

### Windows / Docker Desktop

From the repository root in PowerShell:

```powershell
.\scripts\setup-local-private.ps1
.\scripts\run-local-private.ps1
.\scripts\verify-local-private.ps1
```

These scripts generate local configuration, build Lajur. from source, and perform a non-destructive health check. The historical `-private` filenames do **not** imply that this GitHub repository is private.

**Never commit** `.env`, database dumps, credentials, or actual financial data. Before exposing an instance to the internet, verify HTTPS, authentication, access controls, and backup **restoration**.

## Repository structure

| Path | Purpose |
| --- | --- |
| `packages/frontend/` | Vue 3, TypeScript, Vite, application UI |
| `packages/backend/` | Node.js API, authentication, and financial services |
| `packages/shared/` | Shared types and utilities |
| `self-hosting/` | Docker Compose configuration and build files |
| `docs/` | Development notes, setup guides, design decisions |
| `packages/docs/`, `packages/landing/` | Inherited upstream material; **not** live Kasana websites |

## Development status

Kasana is **under active development**. A passing build does not establish data integrity, safe backups, or production readiness. Check [open pull requests](https://github.com/man612/Kasana/pulls), [CI runs](https://github.com/man612/Kasana/actions), and [tracking issues](https://github.com/man612/Kasana/issues) for the latest status.

Internal package names such as `budget-tracker-*` and the Docker Compose project name `moneymatter-private` are kept for compatibility. **Renaming the Compose project without a migration may make existing database volumes appear missing.** A public GitHub name does not need to match internal identifiers.

## Contributing and security

Contributions are welcome through [issues](https://github.com/man612/Kasana/issues) and pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Kasana does **not** require signing the upstream MoneyMatter CLA.

For vulnerabilities, follow the [Security Policy](.github/SECURITY.md). Do not publish credentials, personal finance records, or undisclosed exploit details in public issues.

## License and acknowledgments

Kasana is based on **MoneyMatter by its original author and contributors**, with independent adaptations. See [LICENSE](LICENSE) and [LICENSING.md](LICENSING.md) for the GNU Affero General Public License v3.0 and upstream licensing history.

Kasana is not affiliated with MoneyMatter's commercial cloud service, documentation domain, or external communities. Upstream URLs identify the original project only.
