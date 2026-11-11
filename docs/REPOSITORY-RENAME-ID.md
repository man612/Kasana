# Repository Rename and Public Identity Audit

> **Historical filename:** This document retains its `-ID.md` path so existing GitHub links do not break. Its content is now written in English, in keeping with Kasana's public documentation policy.

As of **November 11, 2026**, the repository is [`man612/Kasana`](https://github.com/man612/Kasana), **Public**, with `main` as its default branch. **Kasana** is a working product name and can be renamed again later.

## Verified changes after the rename

- The clone URL, README, CI badge, issue templates, security policy, and contributor guidance refer to `man612/Kasana`.
- Docker instructions build **Kasana source** using the base, build, and independent-instance Compose files. Running the base Compose file alone still pulls upstream MoneyMatter images.
- Inherited upstream CLA enforcement and deployment/backup paths are not enabled for Kasana.
- The original `server.json` registry was removed because it advertised an unrelated live MoneyMatter MCP service. A Kasana registry descriptor must only be published when a real Kasana-owned endpoint is available.
- Both production images now declare Kasana's own `org.opencontainers.image.source` label. The inherited marketing site is excluded from the frontend production image. An unconfigured MCP endpoint is not advertised.
- [LICENSE](../LICENSE), [LICENSING.md](../LICENSING.md), original copyrights, and historical [MoneyMatter](https://github.com/letehaha/moneymatter) attribution must be retained.

## GitHub About: verified public metadata

On **November 11, 2026**, the repository administrator applied and verified the About description and topics. The website remains empty until an independent Kasana site is deployed. A social-preview asset has not been verified.

**Description:**

> Open-source, self-hosted personal finance with an Indonesia-first experience.

**Website:** leave empty until Kasana has its own working, verified official website. Do not use `moneymatter.app`.

**Topics:** `personal-finance`, `budgeting`, `expense-tracker`, `self-hosted`, `indonesia`, `rupiah`, `vue`, `typescript`, `agpl-3`.

**Social preview:** optionally upload a branded 1280×640 PNG/JPEG under 1 MB in Settings → Social preview. Do not present inherited MoneyMatter screenshots as verified Kasana screenshots.

## Repository language policy

- **English:** GitHub About, README files, contributing policy, issue and PR templates, security and conduct policies, and public developer documentation.
- **Bahasa Indonesia:** the product's default interface, localized UI strings, and user-facing Indonesian examples.
- Preserve translation resources for other supported languages. A project's documentation language and its default app locale do not need to match.
- Public copy should be factual and understated. Do not claim Indonesian bank integration, a hosted cloud offering, production readiness, or complete QA unless independently verified.

## Local Git, VPS, and external integrations

Update the `origin` remote on each clone that still uses the old URL:

```bash
git remote set-url origin https://github.com/man612/Kasana.git
git remote -v
```

Check Git remotes on Windows, VPS, Dokploy/Portainer integrations, Cloudflare, webhooks, external CI and deployment systems, and documentation links. GitHub redirects most old repository URLs, but **renamed GitHub Actions references** such as `uses: OWNER/REPO@REF` are not guaranteed to redirect.

**Do not rename production Docker resources just for branding.** The `moneymatter-private` Compose project, `moneymatter-private-net` network, and `moneymatter-private-*` image tags are historical deployment identifiers. A project rename without volume migration can make existing databases appear to vanish. Internal `budget-tracker` package names and `*-private.ps1` filenames are also intentionally retained.

## Outstanding release and security requirements

- [PR #10](https://github.com/man612/Kasana/pull/10) remains a separate UI integration under QA. Repository rename work must not be used as a reason to merge it early.
- Previous frontend/backend CI failures were fixed; [run #42878060359](https://github.com/man612/Kasana/actions/runs/42878060359) passed all checks on commit `fe10505c`. Check the latest PR #10 head for newer changes before reporting current CI green.
- Legacy upstream backup and deployment jobs are blocked for Kasana. No Kasana production auto-deploy has been verified.
- The inherited `packages/docs` and `packages/landing` content is not an official Kasana site.
- Public Git history and old Actions logs/artifacts still need comprehensive secret auditing. Revoke and rotate exposed credentials at the provider.

For any later product rename, re-check the README, GitHub About, remote URLs, badges, links, workflows, source metadata, webhooks, and deployment configuration. Database migrations must be evaluated separately from branding changes.

Reference: [GitHub Docs — Renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).
