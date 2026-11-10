# Public Repository Security Readiness

> **Historical filename:** This document keeps its `-ID.md` path for link compatibility. Public-facing documentation is now written in English.

**Status — November 11, 2026:** [`man612/Kasana`](https://github.com/man612/Kasana) is **Public**. An initial check found no high-confidence token patterns in the examined changes, but it did **not** cover every historical commit, branch, Actions log, or artifact. Absence of a pattern match is **not** proof that no secret was exposed.

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

## What the initial audit did and did not prove

On November 10, 2026, high-confidence secret-pattern checks on the integration PR diff and ten Kasana commits since the upstream snapshot found no known token or private-key patterns. Eight common secret-file paths had no commits in the history checked. These checks were **limited**, not a comprehensive security audit.

After the repository became Public, GitHub Actions started assigning runners, revealing ordinary test and infrastructure failures that still require separate fixes. Public visibility alone is not a release-approval or security certification.
