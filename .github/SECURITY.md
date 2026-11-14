# Security Policy

Lajur. is an independent open-source project. Public issues and pull requests are **not** appropriate places for passwords, private financial data, tokens, private keys, database backups, or undisclosed exploit details.

## Reporting a vulnerability

Use GitHub's [private vulnerability reporting] (if enabled)(https://github.com/man612/Kasana/security/advisories/new). Reports sent through this form are not public issues.

If the form is unavailable, use an **existing private channel** to contact the maintainer. If you have no such channel, open a public issue requesting a secure reporting method **without describing the vulnerability or including sensitive information**.

Include the affected commit or version, a minimal reproduction using dummy data, expected impact, and sanitized logs.

## Scope

This policy covers code published in [man612/Kasana](https://github.com/man612/Kasana). Lajur. does not operate `moneymatter.app`, Docker images under `letehaha/*`, or MoneyMatter's hosted infrastructure. Report problems with those services to their respective operators.

There is no guaranteed response-time SLA or separately maintained long-term support branch at present.

## Dependency review and patching

The repository uses Dependabot to propose dependency updates and a separate pull-request Dependency Review check to flag **new** high/critical vulnerabilities. Neither system establishes that the current default branch is vulnerability-free. Dependency alerts for existing versions must be reviewed independently and updated deliberately, including build-time tools.

Review both lockfiles with `npm audit` from the repository root and from `packages/docs`; also inspect GitHub's **Security → Dependabot** alerts, advisory affected versions, exploitability, and real usage. Prefer a targeted version or lockfile fix with tests over `npm audit fix --force`, which may introduce breaking dependency changes. Do not enable automatic merging of security-sensitive dependency changes without verification.

## Securing a self-hosted deployment

Keep `.env` out of version control, use HTTPS, restrict access to PostgreSQL and Redis, and maintain encrypted backups with a tested restore process. Public source code does not mean a particular installation is production-ready.
