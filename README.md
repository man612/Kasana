<div align="center">

<img src="packages/frontend/public/web-app-manifest-192x192.png" width="88" alt="Lajur. icon">

# Lajur.

**A clearer view of your money.**

Open-source, self-hosted personal finance with an Indonesia-first experience.

[![CI](https://github.com/man612/Kasana/actions/workflows/check-source-code.yml/badge.svg?branch=main)](https://github.com/man612/Kasana/actions/workflows/check-source-code.yml)
[![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

[Get started](#getting-started) · [Self-hosting](self-hosting/README.md) · [Contribute](CONTRIBUTING.md) · [Issues](https://github.com/man612/Kasana/issues) · [Security](.github/SECURITY.md)

</div>

The app display name is **Lajur.** (including the period). The historical GitHub repository path remains `man612/Kasana` to preserve existing links. Brand assets are maintained using the [branding guide](docs/BRANDING.md); upstream copyright and AGPL-3.0 obligations remain intact.

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

> **Current limitations:** Indonesia-first does **not** imply automatic Indonesian bank or e-wallet integration. The independent app is under active development; inherited translations, workflows, and documentation still need review. The [active feature branch](https://github.com/man612/Kasana/tree/feat/lajur-finance-ux-dashboard-accounts-loans-20261114) and [open pull requests](https://github.com/man612/Kasana/pulls) contain work not yet merged into `main`. Read the exact branch and CI status before deploying; the `main` CI badge does not validate unmerged changes.

## Getting started

For the current draft release candidate, see the [clean-install public launch gates](docs/security/2026-11-17-public-clean-bootstrap-gates.md). The [15 November rehearsal](docs/INTEGRATION-REHEARSAL-2026-11-15.md) is historical, not the current release target.

Build Lajur. **from this repository's source**. The base Compose file uses intentionally non-pullable placeholder images for the finance frontend and backend; it is **not** a standalone deployment. Always combine the base, build, and private-instance overlays as shown below.

**Prerequisites:** Git, a Linux container runtime (Podman preferred on Windows; Docker supported), Docker Compose v2, and sufficient memory and storage for a frontend source build.

These commands check out the current **draft umbrella PR #10 branch** for development and isolated testing only. It includes the latest finance fixes but is NOT a published production release. Do not expose this draft to real user finance data or open public registration. The `main` branch does not yet contain this work; verify the exact commit and CI before every installation.

### Linux / VPS

```bash
git clone --branch feat/kasana-indonesia-ui-integrated --single-branch https://github.com/man612/Kasana.git
cd Kasana/self-hosting
cp .env.example .env
# Edit .env: replace every __REPLACE_ME__ placeholder.
# For a public server, configure your actual HTTPS origin.
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml ps
```

For a local test installation, open `http://localhost:8080`; use `-BaseUri` with the verifier if you configured another port. Read the [self-hosting guide](self-hosting/README.md) and [Windows/VPS setup notes](docs/LOCAL-VPS-ID.md) before deploying.

### Windows / Podman (preferred) or Docker

Install **PowerShell 7.2+**, Podman with a running Linux machine, and **Docker Compose v2** as its external Compose provider. Docker Engine/Desktop with its Compose plugin is also supported (`-Engine Docker`). See the [runtime preflight and storage cautions](docs/LOCAL-VPS-ID.md).

From the repository root in PowerShell 7 (`pwsh`):

```powershell
.\scripts\setup-local-private.ps1
.\scripts\run-local-private.ps1 -Engine Podman -ValidateOnly
.\scripts\run-local-private.ps1 -Engine Podman
.\scripts\verify-local-private.ps1 -Engine Podman
```

These scripts generate local configuration, build Lajur. from source, and perform a non-destructive health check. The historical `-private` filenames do **not** imply that this GitHub repository is private.

**Never commit** `.env`, database dumps, credentials, or actual financial data. Before exposing an instance to the internet, verify HTTPS, authentication, access controls, and backup **restoration**.

## Repository structure

| Path                                  | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `packages/frontend/`                  | Vue 3, TypeScript, Vite, application UI                        |
| `packages/backend/`                   | Node.js API, authentication, and financial services            |
| `packages/shared/`                    | Shared types and utilities                                     |
| `self-hosting/`                       | Docker Compose configuration and build files                   |
| `docs/`                               | Development notes, setup guides, design decisions              |
| `packages/docs/`, `packages/landing/` | Inherited upstream material; **not** published Lajur. websites |

## Development status

Lajur. is **under active development**. A passing build does not establish data integrity, safe backups, or production readiness. Check [open pull requests](https://github.com/man612/Kasana/pulls), [CI runs](https://github.com/man612/Kasana/actions), and [tracking issues](https://github.com/man612/Kasana/issues) for the latest status.

Internal package names such as `budget-tracker-*` and the Docker Compose project name `moneymatter-private` are kept for compatibility. **Renaming the Compose project without a migration may make existing database volumes appear missing.** A public GitHub name does not need to match internal identifiers.

## Contributing and security

Contributions are welcome through [issues](https://github.com/man612/Kasana/issues) and pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Lajur. does **not** require signing the upstream MoneyMatter CLA; its historical copy is archived in [docs/upstream/CLA.md](docs/upstream/CLA.md).

For vulnerabilities, follow the [Security Policy](.github/SECURITY.md). Do not publish credentials, personal finance records, or undisclosed exploit details in public issues.

## Branding and repository housekeeping

The current app icon is generated from `packages/frontend/assets/app-icon-source.png`. Use the documented [asset regeneration command](docs/BRANDING.md) rather than any inherited logo generator. Review the [repository hygiene guide](docs/REPOSITORY-HYGIENE.md) before removing tests, fixtures, migrations, localization assets, or legacy compatibility paths.

## License and acknowledgments

Lajur. is derived from **MoneyMatter by its original author and contributors**, with independent modifications. See [LICENSE](LICENSE) and [LICENSING.md](LICENSING.md) for the GNU Affero General Public License v3.0 and upstream licensing history.

Lajur. is not affiliated with MoneyMatter's commercial cloud service, documentation domain, or external communities. Upstream URLs identify the original project only.
