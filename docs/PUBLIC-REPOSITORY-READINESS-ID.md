# Public Repository Security Readiness

> **Historical filename:** This document keeps its `-ID.md` path for link compatibility. Public-facing documentation is now written in English.

**Status — November 11, 2026:** [`man612/Kasana`](https://github.com/man612/Kasana) is **Public**. GitHub Secret Scanning, Push Protection, Dependabot alerts and security updates, and private vulnerability reporting are now enabled and were verified through the repository API. Zero open GitHub Secret Scanning and Dependabot alerts were returned at the initial check; this is not a guarantee that every historical secret pattern is detected.

Kasana is an independent adaptation of [MoneyMatter](https://github.com/letehaha/moneymatter) under AGPL-3.0-only. Publishing source code is appropriate, but never commit passwords, API keys, tokens, database dumps, personal financial data, SSH keys, or production configuration.

## Why inherited infrastructure workflows are restricted

MoneyMatter included workflows for PostgreSQL backups to R2, VPS deployment, PR previews, documentation publishing, and Crowdin sync. These belong to the upstream project. Kasana's copy uses `github.repository == 'letehaha/moneymatter'` guards so these jobs cannot run on Kasana.

The standard lint/test/build workflow remains enabled. Its concurrency configuration cancels superseded PR runs while preserving `main` and manually started runs.

## Security review checklist

1. Scan **all Git refs and history**, including deleted files and old branches, with a dedicated secret scanner such as Gitleaks. A scan of `main` alone is insufficient.
2. Audit old **GitHub Actions logs and artifacts**. Sensitive content may have become publicly visible when repository visibility changed.
3. Review repository and environment secrets, Actions permissions, third-party apps, and webhooks. Do not display or paste secret values into GitHub issues.
4. Confirm upstream VPS, R2, Crowdin, and Docker Hub publication workflows are guarded on `main` and in development branches.
5. Keep `.env`, private keys, backups, and financial data outside Git. A sanitized example file such as `.env.example` may remain tracked.
6. If secrets are discovered, **revoke or rotate them at the provider first**. Deleting a file from the latest commit does not remove the credential from Git history.
7. Require actual CI results—not merely a green-looking overview or skipped jobs—before merging financial logic or deploying a live installation.
8. Preserve the upstream AGPL license, historical notices, and any source-distribution obligations that apply to a network-accessible modified service.

## Independent historical secret scan — November 11, 2026

- Used the official Gitleaks **v8.30.1 Windows binary**, verified against the release's published SHA-256 checksums.
- Fetched all remote branches and tags into a **separate audit checkout** (20 Git refs, 2,991 reachable Git commits). Gitleaks reported scanning 2,390 commits' patches across the available references with `git --log-opts --all --redact=100`.
- Found **27 detector matches**: 16 `private-key` and 11 `generic-api-key`. The match report was redacted and kept outside the tracked repository.
- **15 private-key matches** were frontend locale examples containing a literal placeholder `-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----`, not actual key material. **One match** was a test-only 2048-bit RSA private key in the Enable Banking mock fixture, explicitly labeled *testing only* in its source. Never reuse it in a real service.
- The **11 generic-api-key matches** originated in mock/test or generated demo-data source files, not production environment configuration. These are detector findings requiring triage, not evidence of 11 live provider credentials.
- No additional matches appeared when the audit was expanded from the integration branch to all reachable refs. This finding does **not** prove all hosted instances or historical Actions artifacts are safe.

**Remaining caution:** Automated scanning cannot validate whether old example values were ever used as real credentials, whether a token was copied into Actions logs, or whether an external service still accepts any value. If an actual credential is exposed, revoke it at the provider and rotate it before any Git cleanup. Avoid deleting the project's AGPL attribution or rewriting the original authors' Git history as a cosmetic fix.

## What the initial audit did and did not prove

On November 10, 2026, high-confidence secret-pattern checks on the integration PR diff and ten Kasana commits since the upstream snapshot found no known token or private-key patterns. Eight common secret-file paths had no commits in the history checked. These checks were **limited**, not a comprehensive security audit.

After the repository became Public, GitHub Actions started assigning runners, revealing ordinary test and infrastructure failures that still require separate fixes. Public visibility alone is not a release-approval or security certification.

## NGINX base-image security update — November 11, 2026

The inherited production frontend previously used `nginx:1.27-alpine`. The upstream NGINX team released [stable 1.30.6](https://nginx.org/en/download.html) with [fixes for several security advisories](https://nginx.org/en/security_advisories.html) on October 14, 2026. The Kasana production frontend Dockerfile now uses `nginx:1.30.6-alpine` (available in the [official Docker image tags](https://hub.docker.com/_/nginx/tags)); the inherited, independently built documentation image now uses `nginxinc/nginx-unprivileged:1.30.6-alpine` ([published tag](https://github.com/nginx/docker-nginx-unprivileged/pkgs/container/nginx-unprivileged/versions?filters%5Bversion_type%5D=tagged)). These changes require image-build and smoke-test validation; they do not mean an existing VPS has been upgraded or patched.
