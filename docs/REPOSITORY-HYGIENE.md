# Repository hygiene and provenance

This checklist documents the safe cleanup performed for Lajur. on 14 November 2026. The repository history and the original upstream credit remain intact.

## What was reviewed

The feature-branch tree contained roughly 6,450 tracked files and 924 automated-test files (unit, E2E, and specs). Existing `.gitignore` entries already cover `node_modules`, build outputs, Playwright reports, coverage, logs, local environment overrides, test DB caches, and common temporary files. The tracked backend test fixtures, synthetic screenshots, migrations, mock data, and E2E cases are **source assets**, not generated trash. They should not be removed without dependency and fixture-reference audits.

## Cleanup policy

| Kind | Action | Rationale |
| --- | --- | --- |
| Untracked local `dist/`, `coverage/`, browser reports, `*.log` | Ignore / remove locally when safe | Re-creatable output, never source |
| E2E suites, unit tests, fixtures, test helpers | Retain | Regression and financial integrity coverage |
| Database migrations and schema history | Retain | Required for upgrades and existing installations |
| Source branding assets and build scripts | Retain | Canonical source needed for repeatable asset generation |
| Former upstream M-logo generator and unused derived graphics under `docs/brand/` | Remove | Can overwrite current Lajur. branding; not part of running app |
| Legacy standalone K-shaped app logos | Replace with existing canonical S-curve favicon | One coherent visual identity |
| Inherited docs and landing site content | Retain but clearly label unported | Publishing outdated cloud claims as Lajur. would be misleading |
| Upstream CLA | Archive at `docs/upstream/CLA.md` | Historical provenance, not an active contributor requirement |
| `LICENSE` and original copyright notices | Preserve | AGPL and upstream attribution obligations |

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
