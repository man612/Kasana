# Repository hygiene and provenance

This checklist documents the safe cleanup performed for Lajur. on 14 November 2026. The repository history and the original upstream credit remain intact.

## What was reviewed

The feature-branch tree contained roughly 6,450 tracked files and 924 automated-test files (unit, E2E, and specs). Existing `.gitignore` entries already cover `node_modules`, build outputs, Playwright reports, coverage, logs, local environment overrides, test DB caches, and common temporary files. The tracked backend test fixtures, synthetic screenshots, migrations, mock data, and E2E cases are **source assets**, not generated trash. They should not be removed without dependency and fixture-reference audits.

## Cleanup policy

| Kind                                                                             | Action                                          | Rationale                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Untracked local `dist/`, `coverage/`, browser reports, `*.log`                   | Ignore / remove locally when safe               | Re-creatable output, never source                              |
| E2E suites, unit tests, fixtures, test helpers                                   | Retain                                          | Regression and financial integrity coverage                    |
| Database migrations and schema history                                           | Retain                                          | Required for upgrades and existing installations               |
| Source branding assets and build scripts                                         | Retain                                          | Canonical source needed for repeatable asset generation        |
| Former upstream M-logo generator and unused derived graphics under `docs/brand/` | Remove                                          | Can overwrite current Lajur. branding; not part of running app |
| Legacy standalone K-shaped app logos                                             | Replace with existing canonical S-curve favicon | One coherent visual identity                                   |
| Inherited docs and landing site content                                          | Retain but clearly label unported               | Publishing outdated cloud claims as Lajur. would be misleading |
| Upstream CLA                                                                     | Archive at `docs/upstream/CLA.md`               | Historical provenance, not an active contributor requirement   |
| `LICENSE` and original copyright notices                                         | Preserve                                        | AGPL and upstream attribution obligations                      |

The unported Astro landing layout and Starlight docs now default to `noindex` metadata to reduce accidental indexing. This is an advisory metadata boundary, **not** an access-control or deployment safeguard. The inherited pages still require full adaptation before any public Lajur. site launch.

A [Dependency Review](../.github/workflows/dependency-review.yml) workflow checks changes introduced by pull requests for high/critical vulnerable dependencies. A separate [Dependency Baseline Audit](../.github/workflows/dependency-baseline-audit.yml) runs an informational npm audit against the root and docs lockfiles (production dependencies and full development trees) to monitor existing issues. Neither tool automatically remediates vulnerabilities or proves exploitability; review GitHub security alerts and patch affected packages deliberately.

**Still pending:** Inherited packages under `packages/docs/` and `packages/landing/` contain historical MoneyMatter promotional material and social imagery. They are not deployed as Lajur. and have not been comprehensively reauthored. Audit or replace this material before publishing a new marketing or docs site; do not simply relabel cloud claims as Lajur. capabilities.

## Rebuilding brand assets

1. Update `packages/frontend/assets/app-icon-source.png` only with artwork you are entitled to use.
2. Install Pillow, run `python packages/frontend/scripts/generate-brand-icons.py`, and inspect favicon, Apple touch, PWA, and maskable outputs.
3. Confirm `packages/frontend/branding.json` and run `npm -w packages/frontend run branding:sync`.
4. Verify icons at 16–32 px, 192 px, 512 px, and within a maskable icon safe zone, and verify the web manifest icons all exist.
5. The generator refreshes all five shared SVG logo copies automatically. The public-identity CI guard rejects stale assets or missing web-manifest icons.
6. Use `docs/BRANDING.md` as the maintained guide; do not run retired upstream brand generators.

## Verification required before merging

- Confirm README commands against the intended target branch and note that `main` may lag behind active feature work.
- Run format/lint checks and focused backend/frontend tests when a build-capable workstation is available.
- Inspect actual rendered logo/favicon, docs preview, and PWA installation on desktop/mobile.
- Verify source availability and attribution in running app's legal notice.
- Recheck GitHub Actions, branch protection, dependency advisories, and any deployment secrets separately.
- Do not clean old image files from git history by rewriting commits: this would damage traceability and can break clones, tags, and open pull requests.

See [LICENSING.md](../LICENSING.md), [BRANDING.md](BRANDING.md), the [official GNU AGPL](https://www.gnu.org/licenses/agpl-3.0.html), and the [W3C Web App Manifest specification](https://www.w3.org/TR/appmanifest/).

## Follow-up hardening

The shared workspace contained no executable test suite and advertised `echo "Error: no test specified" && exit 1`. That misleading script is removed; backend/frontend tests remain the actual regression suites. No tests, fixtures, migrations or localization files were deleted.

Windows source-build scripts share a small engine preflight with explicit Podman/Docker selection, installed-CLI detection, Windows Podman machine checks, runtime connectivity, external Compose provider checks, quiet configuration validation and checked exit codes. Auto prefers Podman and stops on a selected runtime failure. It never silently switches storage. Verification reports running services, the four required healthchecks, and frontend HTTP separately. Setup requires PowerShell 7.2+, creates independent random secrets, and refuses to replace an existing env file even if it appears during execution. See [runtime instructions](LOCAL-VPS-ID.md).

The inherited landing package remains an npm workspace: the root lockfile, landing npm commands, and production Dockerfile dependency stages reference its package metadata. Removing it would change installation/build inputs and needs its own verified change. Production app images exclude its content; `noindex` alone is not a publishing safeguard. No inactive scripts were deleted on an assumption of non-use.

The [offline documentation validator](../scripts/check-doc-links.mjs) checks relative Markdown links and anchors across maintained root/setup/QA guides. It deliberately excludes historical upstream site articles and does not claim external HTTP availability. The [mocked PowerShell checks](../scripts/tests/local-container-engine.tests.ps1) use temporary synthetic files and mocked CLIs/HTTP, never a real container installation. CI runs them on Windows; cloud PowerShell execution on Linux cannot establish actual Windows/Podman compatibility.

The [branding provenance note](BRANDING.md#icon-provenance-and-permissions) records unresolved artwork permissions without changing the canonical PNG. See [integration reconnaissance](INTEGRATION-2026-11-14.md) for current PR dependencies, conflicts and the #26 debugging evidence.

## Execution evidence — 14 November 2026

This follow-up starts at PR #24 commit `3314f5a` on `chore/lajur-repository-hygiene-20261114`. Only documentation, repository checks, the shared placeholder test script and local runtime scripts changed; no application logic, lockfiles, schemas, migrations, translations, Compose resource definitions or production infrastructure changed.

| Check                                                                                                      | Result and limits                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git diff --check`                                                                                         | **PASS**                                                                                                                                                                                                                         |
| `node scripts/check-public-identity.mjs`                                                                   | **PASS**, existing guard retained                                                                                                                                                                                                |
| `node scripts/check-compose-boundaries.mjs`                                                                | **PASS**, Docker Compose v2.40.3 configuration only; synthetic variables, no services started                                                                                                                                    |
| `node scripts/check-doc-links.mjs`                                                                         | **PASS**, maintained relative links/anchors; external HTTP availability not tested                                                                                                                                               |
| `oxfmt --check` on changed supported files; `node --check` and `oxlint` on the new `.mjs` checker          | **PASS**                                                                                                                                                                                                                         |
| `npm run lint`                                                                                             | **PASS**, existing frontend style warnings remain; i18n-key check passed                                                                                                                                                         |
| Backend typecheck                                                                                          | **PASS**, first half of `npm run typecheck`                                                                                                                                                                                      |
| Frontend typecheck                                                                                         | **PASS** with `NODE_OPTIONS=--max-old-space-size=4096 npm -w packages/frontend run typecheck`; the initial default-heap invocation **FAILED** with Node heap exhaustion (exit 134), not a reported TypeScript diagnostic         |
| Focused backend unit tests                                                                                 | **PASS**, 3 suites / 17 tests covering backend branding, MCP metadata and email identity (exact command below)                                                                                                                   |
| Focused frontend unit tests                                                                                | **PASS**, 2 files / 38 tests: `npm -w packages/frontend run test:unit -- --run --pool=threads --maxWorkers=2 src/common/utils/accent-theme.spec.ts src/components/fields/utils/formatted-amount.test.ts`                         |
| PowerShell syntax and synthetic tests                                                                      | **PASS**, PowerShell 7.4.7 on Linux, all scripts parsed and 32 assertions; temporary downloaded runtime, mocked engines/HTTP and temporary synthetic env files only                                                              |
| License/CLA/icon/config/sync integrity                                                                     | **PASS**, `LICENSE` and archived CLA match the initial `main` blobs; PNG, branding JSON and sync script match the starting PR head byte for byte                                                                                 |
| Broader unit suites                                                                                        | **NOT COMPLETED**: broad backend run was interrupted after correcting an unsupported plural Jest filter; broad frontend fork and thread runs were interrupted in favor of the focused suites above. Do not count these as passes |
| Full application E2E, production builds, workstation/browser/PWA, actual Podman Compose build/start/health | **NOT RUN** for this follow-up. Podman is unavailable in this cloud environment. Earlier CI is recorded separately in the integration snapshot; it does not certify this revision                                                |

The focused backend command was:

```bash
npm -w packages/backend run test:unit -- --runInBand --testPathPattern='(i18n/kasana-brand|scripts/generate-mcp-metadata|services/email/index)\.unit'
```

### Files changed in this follow-up

- Runtime and tests: `scripts/local-container-engine.ps1`, `scripts/setup-local-private.ps1`, `scripts/run-local-private.ps1`, `scripts/verify-local-private.ps1`, `scripts/tests/local-container-engine.tests.ps1`.
- Repository checks and policy: `scripts/check-doc-links.mjs`, `.github/workflows/check-source-code.yml`, `.github/SECURITY.md`, `packages/shared/package.json`, `AGENTS.md`.
- Root/package/operator guides: `README.md`, `CONTRIBUTING.md`, `LICENSING.md`, `packages/backend/README.md`, `self-hosting/README.md`, `self-hosting/docs/environment-reference.md`, `self-hosting/docs/setup-guide.md`.
- Maintained notes: `docs/BRANDING.md`, `docs/KASANA-MOTION-SYSTEM.md`, `docs/LOCAL-PREVIEW-QA-2026-11-14.md`, `docs/LOCAL-VPS-ID.md`, `docs/PANDUAN-ANGGARAN-PINJAMAN-ID.md`, `docs/PUBLIC-REPOSITORY-READINESS-ID.md`, `docs/QA-KASANA-RELEASE.md`, `docs/REPOSITORY-HYGIENE.md`, `docs/REPOSITORY-RENAME-ID.md`, `docs/UI-INDONESIA.md`, `docs/application-setup.md`, `docs/self-hosting.md`, `docs/INTEGRATION-2026-11-14.md`.

### Windows verification — not executed on the workstation

From the intended checkout in PowerShell 7.2+, using the engine/connection that owns the existing installation:

```powershell
podman --version
podman machine list
podman system connection list
podman info
podman compose version
pwsh -NoProfile -File .\scripts\tests\local-container-engine.tests.ps1
pwsh -NoProfile -File .\scripts\run-local-private.ps1 -Engine Podman -ValidateOnly
pwsh -NoProfile -File .\scripts\verify-local-private.ps1 -Engine Podman -BaseUri http://127.0.0.1:8080
```

The last two commands require the existing `self-hosting/.env`; verification assumes the documented Compose project already exists. Set `-BaseUri` to the configured loopback port if different. These commands do not start containers or replace credentials. For a **fresh** installation, follow the setup/build steps in [LOCAL-VPS-ID.md](LOCAL-VPS-ID.md); do not regenerate an existing installation's secrets. Docker verification uses the same scripts with `-Engine Docker`.
