# Option B public-deployment readiness: security and operations research

**Status:** Pre-production assessment, **not** production approval or an infrastructure change  
**Reviewed source:** PR #10 head `61385daf84056cf7540f0ccd20cba1e1476c9fb1` (17 November 2026)  
**Target:** Public-domain, self-hosted Lajur. with Vue/Nginx + Express/Better Auth + PostgreSQL + Redis on a VPS; Cloudflare Free/Tunnel ingress; Resend email; private attachment storage (disk initially, optional R2); independent Restic/B2 backups. See [the architecture decision](../DEPLOYMENT-OPTION-B-DECISION.md).

This document separates **confirmed source behavior**, **vendor guidance**, **operator-required work**, and **unknowns**. Green unit/E2E/CI results are not evidence that an actual Cloudflare account, domain, VPS, R2 bucket, email sending domain or off-site backup exists. No real secrets, users or data were accessed in this review.

## Confirmed code findings and their implications

| Topic | Verified behavior on reviewed source | Public-launch implication |
| --- | --- | --- |
| Edge routing | `self-hosting/docker-compose.yml` keeps backend/Postgres/Redis on an internal network; frontend exposes `HTTP_PORT`, defaulting to all-host port `8080` when unset | Set `HTTP_PORT=127.0.0.1:8080` if tunnel daemon runs on the VPS host, or use an **internal** Docker network route. Independently block direct ingress; verify actual bindings and firewall. Never expose DB/Redis ports |
| Auth origin | `BETTER_AUTH_URL` and `AUTH_ORIGIN` default to `http://localhost:8080`; secure-cookie mode depends on an actual HTTPS origin | Set **both** to exactly the same deployed HTTPS origin; test redirects, cookies, CSRF, proxy IP attribution, OAuth/MCP and passkeys |
| Registration | `areSignupsOpen()` treats an omitted or invalid `SYSTEM_MAX_SIGNUPS_ALLOWED` as **unlimited**; template leaves cap commented out | Explicitly decide whether/when public signups are permitted. For a pre-launch instance, start with cap **0**, then choose a reviewed finite cap or a consciously approved unlimited policy. Rate-limiting does not impose an account-count ceiling |
| Email | Better Auth `emailAndPassword.requireEmailVerification` is conditional on `RESEND_API_KEY` being configured; password reset delivery requires email integration | Public signups without Resend allow email/password registration without verification. Configure a verified sending domain, then test verify/reset/resend, failed delivery, exhaustion and anti-abuse using synthetic accounts |
| WebAuthn | Passkey RP ID defaults to `localhost` if not set | Set `AUTH_RP_ID` to the correct public domain; verify origin/RP ID on actual devices; the display fallback was already corrected to `Lajur.` |
| Cloudflare ingress | Better Auth checks the session; Cloudflare Tunnel is only a network route | Do not assume Tunnel enforces user login; Access in front of the **whole** public domain would introduce a second identity gate. Review operator-only route protection separately |
| Attachments | `packages/backend/src/services/attachments/storage.ts` defaults to disk volume; specifying an S3-compatible bucket switches **new** storage operations to that bucket | Keep the bucket **private**, ensure server authorization for downloads, and never assume setting R2 credentials migrates old local blobs. Test DB+blob restoration together |
| Data rights | `packages/frontend/public/operator-notice.html` expressly says it is **not** the operator's privacy notice/terms | Publish operator-specific identity/contact, processing disclosure, retention, user-rights and incident procedures before accepting real third-party finances |
| Backups | `self-hosting/tests/backup-restore-synthetic.sh` verifies isolated disposable PostgreSQL + fabricated attachment restore in CI | Does **not** prove encrypted off-site backups, recoverability of actual Better Auth accounts, complete attachment/R2 backup, or operator recovery after VPS failure |
| Logs | The prior Nginx `log_format main` recorded `$request` (including query) and `$http_referer`; backend Morgan recorded raw query parameters | Reset links carry `?token=...`. This branch removes query/Referer from Nginx access logs and query strings from backend Morgan logs, retaining explicit path-token redaction. CI and real image validation are still required |
| Legal and artwork | AGPL/source information is available; [branding provenance](../BRANDING.md#icon-provenance-and-permissions) records unverified icon rights | Confirm right to distribute the icon; publish corresponding source of the **actual deployed SHA**, preserve upstream attribution and obtain legal review for applicable PSE/PDP obligations |

### Why the access-log change matters

`packages/frontend/src/lib/reset-password-token.ts` calls `history.replaceState` to remove `?token=` **in the browser**, before analytics setup. But the browser already sent the initial request to Nginx, where the previous `$request` access log would capture the query string. Other one-time auth or OAuth callbacks also use URL parameters.

The isolated implementation on this branch now logs `$request_method $uri $server_protocol` in Nginx (no arguments), and passes backend `req.originalUrl` through `safeRequestLogUrl` (strip query and redact old path-based reset tokens). It deliberately preserves HTTP status, route-level visibility where available, user-agent and source IP; `$uri` can reflect internal Nginx rewrites, which may reduce path granularity. The change cannot retroactively erase old logs or guarantee that **other** upstream/CDN/proxy/analytics/error logs are sanitized. Set log access control and retention separately.

References: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html); [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html); [Nginx variables](https://nginx.org/en/docs/http/ngx_http_core_module.html); [Nginx access logging](https://nginx.org/en/docs/http/ngx_http_log_module.html).

## Mandatory acceptance gates before a public launch

**P0 — never skip**

- [ ] **Operator decision:** Confirm who is responsible for running the service, how signup, support, incident response and account deletion work, and whether actual third-party financial data will be accepted.
- [ ] **Indonesian legal review:** Assess the private electronic-system-operator (PSE Lingkup Privat) registration criteria **for the actual service model**; do not equate a personal finance tracker with a licensed bank/payment processor, or infer an automatic exemption. Assess Law 27/2022 personal-data duties, notices, access/erasure, retention, cross-border processing and breach-response responsibilities with qualified advice.
- [ ] **Privacy and legal pages:** Replace the operator-specific placeholder with accurate, accessible privacy/terms/contact content **for this deployment**, reviewed by its operator. Do not attribute service-level obligations to upstream authors.
- [ ] **Ingress:** Verify Cloudflare DNS/Tunnel routes the intended HTTPS hostname to the correct frontend; no direct unprotected app port, backend, PostgreSQL or Redis; lock down outbound tunnel credentials; no production secrets in Git. Do not configure Cloudflare Access globally for a public self-registration flow without a deliberate product decision.
- [ ] **Session protection:** Test public HTTPS cookies, `AUTH_ORIGIN`/`BETTER_AUTH_URL`, trusted proxy and client-IP handling, logout/session revocation, CSRF, signup brute-force and rate limits; default signups are unlimited when the limit env is omitted. Use real synthetic accounts.
- [ ] **Email:** Configure verified Resend sender domain, SPF/DKIM/DMARC, and `RESEND_FROM_EMAIL`; confirm actual delivery of verification and password reset, not just mock calls; enforce a reviewed enrollment policy before opening registration.
- [ ] **Sensitive responses:** Verify no authenticated API, financial HTML or private attachment is stored by a Cloudflare **Cache Everything** or Edge TTL rule. Inspect real `CF-Cache-Status`, `Cache-Control`, cookies, and multi-user isolation. Hash-named JS/CSS assets may be cached publicly.
- [ ] **Operator-grade backups:** Create transactionally consistent PostgreSQL exports, preserve private attachment blobs (disk and/or R2), needed recovery secrets and configuration **without posting secrets in logs**. Encrypt independently before B2 upload. Apply tested retention and capacity limits.
- [ ] **Independent recovery:** Restore into a separate disposable environment with different namespace, verify Better Auth accounts, category/transactions, loan/investment values and attachment bytes; do not wipe or mount the operator's existing volumes. Exercise a deliberately failed backup, then ensure alerting works.
- [ ] **Release gate:** Review residual moderate/low advisories, permission to distribute the icon, lifecycle warnings and exact deployed AGPL corresponding-source SHA. Complete real Windows/Podman/device/browser QA before handling real finances.

**P1 — explicit owner decisions**

- [ ] Determine whether R2's private bucket, request/storage allowance, payment-method requirement and overage risk are acceptable; otherwise retain private disk volume plus independent off-site backup.
- [ ] Decide whether MCP/OAuth is exposed; leave `MCP_BASE_URL` unset until its endpoints are audited. Review unused upstream/landing pages and metadata to avoid exposing unrelated hosted services.
- [ ] Disable optional analytics/error monitoring (PostHog/Sentry) until personally identifiable information, page URLs, data masking, third-party processing and operator privacy notice are assessed.
- [ ] Review HSTS `includeSubDomains; preload` currently advertised by Nginx: do not commit all subdomains to HTTPS policy without domain-wide readiness. Validate public HTTPS and rollback behavior.
- [ ] Establish safe external synthetic uptime checks and out-of-server backup success alerts; do not use financial or authenticated data in monitor payloads.
- [ ] Decide a provider-agnostic recovery process if Cloudflare/Resend/B2 is unavailable; do not assume a single vendor's free tier guarantees uptime.

## Vendor and community findings (independent of the code review)

1. **Cloudflare ingress:** Tunnel creates outbound-only connections and can publish a public hostname without inbound ports, but the published endpoint is public without an Access gate. In our intended design Better Auth remains the app's primary authentication. Cloudflare documents cache/login failures caused by inappropriate Cache Rules and challenge loops. See [Tunnel](https://developers.cloudflare.com/tunnel/), [Access public application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [cache/login troubleshooting](https://developers.cloudflare.com/cache/troubleshooting/dynamic-content-and-login-issues/) and [origin protection](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/).
2. **Reverse proxy and auth:** Better Auth's [security reference](https://www.better-auth.com/docs/reference/security) and [rate limiting reference](https://www.better-auth.com/docs/concepts/rate-limit) emphasize exact trusted origins, correctly trusted client-IP headers, cookies and per-endpoint restrictions. Do not trust arbitrary incoming forwarding headers.
3. **Indonesian law:** Consult the official [PSE criteria](https://pse.komdigi.go.id/panduan/kriteria-pendaftaran-pse-lingkup-privat), [PSE FAQ](https://pse.komdigi.go.id/pertanyaan-umum), [PM Kominfo 5/2020](https://jdih.komdigi.go.id/produk_hukum/view/id/759/t/peraturan%2Bmenteri%2Bkomunikasi%2Bdan%2Binformatika%2Bnomor%2B5%2Btahun%2B2020), [PP 71/2019](https://jdih.komdigi.go.id/produk_hukum/view/id/695/t/peraturan%20pemerintah%20nomor%2071%20tahun%202019%20tanggal%2010%20oktober%202019) and [Law 27/2022](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B2022). Applicability depends on operator and service; this is a release checklist, not legal advice or a regulatory filing.
4. **Email:** [Resend Free](https://resend.com/pricing) currently advertises 3,000 emails per month and 100/day. Domain ownership and sending DNS must be configured and delivery tested. Quotas and acceptable use can change.
5. **Private file storage:** [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) documents 10 GB-month Standard storage and operation allowances; egress is free, but requests/storage above allowance can be charged. R2 is not a database or a backup of PostgreSQL.
6. **Independent backup:** [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing) offers the first 10 GB storage free subject to applicable billing. [Restic](https://restic.readthedocs.io/en/stable/040_backup.html) recommends `--stdin-from-command` over piping `pg_dump` through `--stdin`, which can silently snapshot truncated data when command failures are masked. Check data integrity and **restore**, not just exit status; see [restic recovery](https://restic.readthedocs.io/en/stable/050_restore.html).
7. **Monitoring:** [Cloudflare standalone Health Checks](https://developers.cloudflare.com/health-checks/) are **not included on Free**. An independent monitor/heartbeat can instead detect total VPS or backup-job failure.
8. **Community caution:** An [October 2026 r/selfhosted discussion](https://www.reddit.com/r/selfhosted/comments/1x8i002/whats_the_safest_way_to_expose_selfhosted_apps_to/) reported user preference for VPN access to sensitive private tools and Cloudflare Tunnel for deliberate public services; this is anecdotal opinion, not evidence that Tunnel itself is insecure. A [database backup discussion](https://www.reddit.com/r/selfhosted/comments/1xfqpq5/how_do_you_handle_backing_up_databases_docker/) highlighted separate dump permissions and the danger of handing backup automation unrestricted Docker socket access; this requires case-by-case threat modeling.

## Minimal read-only checks for the future operator

These commands **do not launch or migrate a stack**. Check out the exact reviewed commit or an approved descendant first.

```powershell
podman machine list
podman system connection list
podman ps -a
podman volume ls
pwsh -NoProfile -File scripts/run-local-private.ps1 -Engine Podman -ValidateOnly
pwsh -NoProfile -File scripts/verify-local-private.ps1 -Engine Podman
```

`-ValidateOnly` requires `self-hosting/.env` and validates runtime/Compose configuration; `verify` requires running services and checks health only. Neither proves login, backup/restore or actual domain safety. Do **not** run `compose down -v`, change Compose project names, reset `.env` or run initial setup over an existing data-bearing installation.

## Review status

- **Implemented on this isolated branch:** Nginx/backend access-log query redaction + unit/static CI guards.
- **Not implemented:** Resend, Tunnel, private R2, off-site B2/Restic jobs, operator privacy/terms, legal registration, physical Podman/device QA, real restore testing, or production security hardening beyond the narrow log change.
- **Approval required:** Any merge into PR #10 or `main`, production installation or use of genuine personal financial data.
