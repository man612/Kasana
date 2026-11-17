# Lajur. Option B — deep release-gate audit

Review date: 17 November 2026.
Reviewed candidate: draft PR #10 at SHA ffc793a6b74d2da9f4887317533c4b03face5c90.
Classification: SOURCE REVIEW / OPERATOR CHECKLIST, NOT a deployment approval.

The code passed 20/20 GitHub application jobs and a separate synthetic encrypted recovery test on this candidate. That is meaningful regression evidence but does NOT establish that any real domain, VPS, Windows Podman host, Resend sending identity, Cloudflare account, private B2/R2 bucket, or personal-finance dataset has been inspected. No such resources were changed.

## Prioritized findings

| Priority | Source-verified observation | Production significance | Exit requirement |
| --- | --- | --- | --- |
| P0 | Backend Compose env_file loads .env and then optional stack.env; the older public preflight read .env alone | Portainer overrides can silently change signup cap, Resend, auth URLs or DB secrets while the preflight incorrectly passes | Model both sources and reject effective config conflicts; verify actual container settings separately |
| P0 | Email-password verification in backend auth.ts is conditional on the Resend integration, while an omitted signup cap remains unlimited | Public accounts can be created without verified email if operators omit mail configuration | Keep new registration disabled until real verification/reset delivery and abuse tests pass |
| P0 | New API cache middleware uses private/no-store, but real Cloudflare Cache/Cache Response Rules remain unverified | Override rules or pre-existing cached data can defeat origin intent | Verify private finance routes using two synthetic sessions and real CF-Cache-Status |
| P0 | Encrypted Restic backup and independent synthetic restore exist, but no real B2 restore has been tested | A successful backup job is not proof of offsite recoverability | Quiesce writes; export DB plus all active attachment storage; restore B2 to fresh isolated environment |
| P0 | BRANDING.md explicitly records unknown source/license of the current S-curve icon | A Git commit does not establish distribution or trademark rights | Obtain creator/license record or substitute clearly licensed original artwork |
| P0 | operator-notice.html explicitly disclaims being the operator's legal privacy notice/terms | A public service handles private financial records, sessions, email addresses and files | Supply accurate operator-specific disclosures/contact, legal review and incident response |
| P1 | Compose still references letehaha/currency-rates-api:latest; Dependabot config covers npm and GitHub Actions, not Docker images | A fresh deployment may pull different exchange-rate service binaries under the same app SHA | Verify correct manifest for platform, test rates/IDR, pin inspected digest, set reviewed update cadence |
| P1 | Last documented npm root baseline: zero critical/high, 8 moderate/8 low (scope overlaps with production 5 moderate/1 low) | Historical npm counts do not certify current dependencies or container layers | Rerun audit, triage each reachable advisory, scan actual images, record approved exceptions |
| P1 | TRUSTED_PROXIES includes loopback, link-local, private ranges; Nginx forwards X-Forwarded-For | Actual cloud tunnel/proxy chain controls IP attribution, rate limits and audit quality | Test spoofed headers and blocked direct-origin route using synthetic requests |
| P2 | Frontend CSP permits unsafe-eval, some inline styles and optional external providers | A broader browser policy and telemetry data-flow require deliberate review | Inventory external calls and consent, then tighten only with browser regression evidence |

## Source-verified Compose failure mode and remediation

The repository self-hosting/docker-compose.yml defines backend env_file entries in this exact order: .env, stack.env. Both are optional; the latter takes precedence for duplicate backend variables. By contrast, PostgreSQL service credentials, frontend HTTP_PORT binding, API_HTTP and backend/frontend listener agreement are interpolated into Compose service configuration from the Compose environment, commonly .env and the operator shell. Thus there are two distinct configuration sources: the backend process environment and the Compose service model.

A realistic synthetic example: .env contains SYSTEM_MAX_SIGNUPS_ALLOWED=0 and valid HTTPS auth and DB settings; stack.env sets SYSTEM_MAX_SIGNUPS_ALLOWED to empty or a different DB password. The old check-public-deployment-env.mjs examined the first file only, returning a misleading PASS even though the actual backend could allow unlimited signup or fail database authentication. The backup implementation had already recognized stack.env as a recovery requirement; the public preflight did not.

This PR adds checkPublicDeploymentSources and checks both files without printing their values. The backend-effective values are checked for auth origins, Resend keys/sender, signup cap, passkey RP domain and secrets. Database credentials and listener ports are cross-checked against Compose-side .env values. Host port/API mode remain Compose-side, not overridden by stack.env in the validator. A public preflight also rejects explicitly enabled demo accounts and unresolved template syntax. Tests cover on-disk fake .env and stack.env, conflicting DB/port settings, and privacy of diagnostic output.

LIMIT: Node parseEnv is not a complete Docker Compose interpolation engine. Host shell overrides, CLI --env-file, extra overlays and Portainer platform-injected variables remain unknown. Passing this offline validator is NOT evidence that a running container has identical values. Inspect actual service configuration only in a trusted private terminal and never paste plaintext Compose output containing secrets to issues, chat, CI or logs. Never create/recreate containers merely to run the offline check.

Primary references:
- https://docs.docker.com/reference/compose-file/services/#env_file
- https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/
- https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
- https://docs.docker.com/reference/cli/docker/compose/config/

## Public authentication and edge requirements

Better Auth's requireEmailVerification needs the email-sending hook; configured key shape alone cannot establish DNS verification, deliverability, retries, bounce behavior or user ownership. Confirm Resend sender-domain SPF/DKIM/DMARC in the operator's authorized account. Test verification/resend/password reset with controlled accounts, including rate limiting and expired/used links. Check sessions and passkeys on actual browsers; the offline suffix check of AUTH_RP_ID does not establish a valid WebAuthn RP domain.

A configured count cap is fail-closed for malformed inputs but is not concurrency-atomic: two near-simultaneous new-account requests can both see free capacity. Keep signup cap 0 before launch and separately test/safeguard admission, owner/viewer access and per-IP/tenant limits. Cloudflare Tunnel provides connectivity, not Better Auth identity verification.

Cloudflare origin caching has improved through PR #38, but rules can override headers. The last conflicting Cache Rule wins and Cache Response Rules can also set cache policy. Confirm that finance API, signed-in files, cookies and reset pages never receive cached cross-user responses. A single MISS is not proof: repeat requests for two distinct synthetic users, inspect CF-Cache-Status and browser data, and examine edge rule order. No sensitive request URLs, tokens or operator cookies should appear in logs or public artifacts.

Primary references:
- https://better-auth.com/docs/authentication/email-password
- https://developers.cloudflare.com/cache/concepts/cache-responses/
- https://developers.cloudflare.com/cache/how-to/cache-rules/order/
- https://developers.cloudflare.com/cache/how-to/cache-response-rules/
- https://developers.cloudflare.com/fundamentals/reference/http-headers/
- https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html

## Data durability and software supply chain

The Restic script intentionally does not run backups on a schedule or modify volumes. PostgreSQL pg_dump creates a consistent logical archive; a separate attachment tar is NOT an atomic snapshot unless writes are paused and uploads drained. A live B2 recovery must prove restore of database, secrets, attachments and representative synthetic accounts into an independent clean stack. R2-enabled attachment stores are excluded by the existing script, rather than silently backed up incompletely. A Restic check without read-data is not a full content-integrity audit. Restic may create an incomplete snapshot and return exit status 3; the operator must treat any nonzero status as failure and review remote partial objects/storage cost. Retention dry-run is required before deletion.

Currency-rates-api uses a mutable latest tag. Docker recommends inspecting and pinning OCI image digests for reproducibility, with explicit reviewed updates so security patches are not frozen indefinitely. Never substitute an unverified digest. Verify resulting historical and live IDR/USD behavior before changing the rate provider, and keep Postgres/Redis upgrade compatibility and volume rollback in scope.

Primary references:
- https://www.backblaze.com/docs/cloud-storage-integrate-restic-with-backblaze-b2
- https://restic.readthedocs.io/en/stable/040_backup.html
- https://www.postgresql.org/docs/16/app-pgdump.html
- https://docs.docker.com/build/building/best-practices/

## Indonesian legal and artwork review

The official PSE Lingkup Privat portal lists criteria under PP 71/2019 and Permenkominfo 5/2020 as amended. Some financially oriented public service models can be in scope. A personal bookkeeping app is NOT automatically a regulated payment/banking institution, but opening it publicly changes obligations. Obtain qualified local assessment based on actual operator, service model, data practices and users. Do not claim mandatory registration or exemption without that assessment.

UU 27/2022 concerning personal data protection applies to relevant processing. The operator must examine lawful basis, disclosures, retention, subject-right requests, security, incident response, hosting and possible cross-border transfers. Generic project notices are not operator-specific terms. Retain upstream copyright and AGPL-3.0 obligations; AGPLv3 Section 13 addresses access to corresponding source for users interacting remotely with a modified program. It does not license third-party icon artwork. Resolve S-curve logo provenance separately.

Primary references:
- https://pse.komdigi.go.id/pertanyaan-umum
- https://jdih.komdigi.go.id/produk_hukum/view/id/759/t/peraturan%2Bmenteri%2Bkomunikasi%2Bdan%2Binformatika%2Bnomor%2B5%2Btahun%2B2020
- https://jdih.kemenkeu.go.id/dok/uu-27-tahun-2022/overview
- https://www.gnu.org/licenses/agpl-3.0.en.html

## Public acceptance matrix

| Requirement | Required synthetic/offline proof | Not proved by GitHub CI |
| --- | --- | --- |
| Network | Correct HTTPS host, trusted IP chain, origin unreachable directly, DB/Redis private | Real domain/Tunnel and firewall |
| Enrollment | Closed-by-default, delivery verified, rate/quota stress, passkeys on devices | Resend and actual WebAuthn session |
| Confidentiality | Two-user isolation, no CDN HIT on private routes, secure cookies and logs | Cloudflare settings and external analytics |
| Finance | IDR/USD, owner/viewer, budgets, loans, investments, import/export, attachment permissions | Real Windows Podman QA |
| Recovery | Offsite B2 encrypted restore, independent secrets, complete blobs, RTO/RPO alerts | Real B2 connectivity and disaster exercise |
| Operator | Icon rights, accurate privacy/legal disclosures, ongoing vulnerability handling, AGPL corresponding-source offer | Legal or launch approval |

Decision: keep source hardening isolated and draft. Do not merge main, deploy, activate public signups, rotate real secrets, migrate databases, change historical Compose volume names or touch user financial records based on this document.
