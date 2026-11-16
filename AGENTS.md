# Repository invariants

- Product display name: **Lajur.**, including the period. Repository: `man612/Kasana`. Keep repository URLs, historical records and internal compatibility identifiers stable.
- Read `CLAUDE.md` and the relevant package conventions before application changes. User instructions take precedence; do not infer permission to deploy, merge, reset data or publish unrelated work.
- Preserve `LICENSE`, AGPL-3.0-only attribution/modification notices and `docs/upstream/CLA.md`. Preserve the canonical S-curve PNG; see `docs/BRANDING.md` for unresolved artwork provenance and display-name synchronization.
- Never rename Compose project `moneymatter-private`, network `moneymatter-private-net`, image tags or volumes without a separately reviewed migration. Podman and Docker storage are separate. Never delete volumes, reset databases or overwrite secrets during hygiene work.
- `packages/docs` and `packages/landing` are unported upstream content, not official Lajur. services. Landing remains in the workspace because lockfile/build steps reference it.
- Use synthetic data and isolated environments. Never inspect or modify a real local installation or VPS for cloud verification.
- Verify with `git diff --check`, `node scripts/check-public-identity.mjs`, `node scripts/check-compose-boundaries.mjs`, `node scripts/check-doc-links.mjs`, targeted `npx oxfmt --check <files>`, `npm run lint`, and `npm run typecheck`. Local PowerShell checks: `pwsh -NoProfile -File scripts/tests/local-container-engine.tests.ps1`.
- Use package npm scripts for tests; report executed results separately from skips. Read-only Compose validation uses all three source/private files with a synthetic env. Never print resolved secret-bearing Compose configuration.
