# Architecture decision: Option B — public Lajur. on a self-hosted VPS

**Status:** Accepted as the **target architecture**, not implemented or approved for production.
**Decision date:** 2026-11-16
**Scope:** Lajur. (GitHub repository `man612/Kasana`)
**Cost objective:** No additional recurring service fee beyond the VPS and domain **while third-party free-tier limits remain sufficient**. This is a goal, not a guarantee; paid usage, payment-method requirements, policy changes, and overages must be reviewed before enabling services.

## Context and decision

The owner selected **Option B: a browser-accessible application on a public domain** rather than a Tailscale-only private service. Keep Lajur.'s existing self-hosted architecture to minimize migration, compatibility, and financial-data risks. This document records the intended deployment; **nothing here states that a VPS, Cloudflare account, R2 bucket, email domain, or backup service has been configured**.

The existing stack already uses Vue/Vite, Nginx, Node.js/Express, Better Auth, PostgreSQL, Redis and a currency-rates helper. Lajur. frontend/backend images are built from repository source using the three Compose files described in [the self-hosting guide](../self-hosting/README.md). Do **not** switch to upstream application images or rename existing Compose projects, networks, or volumes merely for branding.

### Selected components

| Concern                             | Target                                                                                     | Decision                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| User-facing web app                 | Vue 3 + Vite build, served by Nginx on the VPS                                             | **Keep existing**; no Cloudflare Pages/Workers migration                                         |
| API and business logic              | Node.js + Express on the same VPS                                                          | **Keep existing**, internal-only backend                                                         |
| Authentication                      | Better Auth backed by PostgreSQL                                                           | **Keep existing**; no Firebase/Convex/Supabase Auth migration                                    |
| Structured user/finance data        | PostgreSQL 16 on the VPS                                                                   | **Keep existing**; do not put financial records into R2 or D1                                    |
| Session rate limits and jobs        | Redis on the VPS                                                                           | **Keep existing**; private network                                                               |
| DNS, TLS and edge protection        | Cloudflare Free DNS/proxy, WAF controls, **Cloudflare Tunnel** where appropriate           | **Chosen target**, pending setup and real security/HTTP testing                                  |
| Transaction receipt/PDF/image files | Existing private disk volume initially; Cloudflare R2 Standard **optional**                | R2 support exists in the attachment storage adapter but is **not enabled by this ADR**           |
| Transactional email                 | Resend Free, provided quota/eligibility are suitable                                       | **Chosen target**; verify sending domain, SPF/DKIM/DMARC, signup verification and password reset |
| Off-site backups                    | Restic-encrypted backup repository on Backblaze B2 (or equivalent independent destination) | **Chosen target**, pending restore-tested automation and retention sizing                        |
| Scheduled backup reporting          | Healthchecks.io or equivalent outside-VPS heartbeat                                        | **Chosen target**, pending setup                                                                 |
| External uptime checks              | UptimeRobot or equivalent                                                                  | Optional for publicly reachable safe health endpoint; avoid exposing private information         |
| Automated testing                   | Existing GitHub Actions                                                                    | **Keep existing**; green CI does not substitute for real-VPS QA                                  |

Cloudflare R2 is **not** a PostgreSQL replacement. Set `ATTACHMENTS_S3_BUCKET`, `ATTACHMENTS_S3_ENDPOINT`, `ATTACHMENTS_S3_ACCESS_KEY_ID` and `ATTACHMENTS_S3_SECRET_ACCESS_KEY` only after provisioning a **private** bucket and least-privilege credentials. Without a bucket, Lajur. uses the Compose attachment volume. Enabling R2 does not migrate old files; migration/rollback needs a separate plan.

## Proposed request path

`Browser → public HTTPS domain (Cloudflare DNS/proxy + optionally Tunnel) → VPS Nginx (SPA and same-origin /api proxy) → Express/Better Auth → PostgreSQL / Redis`.

Do not host the static SPA on a separate domain initially. Same-origin routing reduces cookie, CORS, OAuth callback, CSP, API proxy and PWA integration risk. Cloudflare Tunnel is an ingress transport, **not** the application login, firewall policy or an authorization substitute.

Cloudflare Access is **not** placed in front of the entire public sign-in flow because it would impose another identity gate and interfere with ordinary public onboarding and API clients. It may be assessed separately for operator-only interfaces. Use Better Auth for per-user identity and server-side authorization. Public registration defaults, email verification, password recovery, account abuse/rate limits and admin access need explicit review before public launch.

## Security and privacy boundaries

- Terminate HTTPS correctly, lock down origin networking, validate proxy forwarding and client IP trust, and verify CSRF/cookies and OAuth/SSO redirects using the actual public URL. Set `BETTER_AUTH_URL` and `AUTH_ORIGIN` to the same correct external HTTPS origin.
- Keep PostgreSQL, Redis, backend and storage credentials off public ports; use minimal network exposure and least-privilege provider/API tokens. Do not commit `.env`, database exports, encryption keys or financial attachments.
- Disable public CDN caching for authenticated HTML/API data and sensitive attachments; verify actual cache and response headers. Cloudflare edge security does not replace application controls.
- Private receipts and account documents must never be accidentally exposed as public R2 objects or unsigned URLs.
- Consider Cloudflare Turnstile only after designing and testing server-side verification at relevant public signup/abuse surfaces.
- Review Cloudflare's TLS termination/privacy trade-offs and the provider's data handling before placing financial information through its edge.
- Keep original application authentication secrets during any real user/account migration; changing keys can invalidate sessions or stored credentials.
- Preserve repository license, upstream attribution, and artwork provenance checks.

## Backup and recovery acceptance

- Back up **PostgreSQL + attachment blobs + the required recoverable deployment configuration/secrets**, not merely the Git repository or database.
- Run encryption before sending backups to independent off-site storage; restrict backup credentials to the designated repository/bucket.
- Use a retention and capacity budget accounting for snapshots, deduplication and growth. Free B2 quota is limited; never silently delete the only restore point to stay within a free tier.
- An external heartbeat should mark backups successful **only after** verified completion. Monitor last success and alert on failure.
- Test restoration into an **isolated, disposable** instance; verify Better Auth sign-in, transactions, balances, attachments, migrations, and representative investment/loan records.
- Record recovery objectives, operational steps and rollback before production launch. No backup script may touch existing data-bearing Podman/Docker volumes without explicit approval.

## Rollout plan and unresolved gates

1. **Current integration checkpoint (2026-11-16):** this ADR remains architecture only. Provider-high remediation is complete in PR #33 (`1bb56417e3513e71d1704ff218c4a8e379ca4391`): Polygon uses the patched decoder bridge and Yahoo v4 uses Zod 4. The draft PR #32 candidate preserves that source history and adds [fail-closed installation verification and moderate-advisory triage](security/2026-11-16-secure-integration.md). No infrastructure is configured by these changes.
2. **Before integration/release approval:** verify final-head PR #32 combined CI and maintainer review. Current verified lock audits have zero critical/high findings; root full retains 8 moderate/8 low, production-only 5 moderate/1 low, and standalone docs 1 moderate. These scopes overlap and are not a deployment security sign-off. Review the documented remaining advisory paths, install-hook/Node 24 contract, icon distribution rights and lifecycle warnings. Public-production acceptance gates below remain open.
3. **Staging/local:** validate the selected Podman/Docker engine and Compose configuration, create **new test-only** credentials, run login and finance smoke tests with synthetic data, then verify rollback and restores. Never use `down -v` on a data-bearing installation.
4. **VPS staging:** configure DNS, HTTPS/Tunnel, public origin, Resend and optional private R2; run multi-browser/mobile, file upload, session, rate-limit, API and backup/restore QA using test accounts.
5. **Production decision:** operator explicitly signs off on security, privacy, billing limits, monitoring, restoration and release. **No automatic deployment/merge is authorized by this document.**

**Deferred / not selected:** Firebase, Convex, Supabase Auth, Cloudflare D1, and a separate Cloudflare-hosted frontend. Reconsider only with a specific requirement and migration design. All external free tiers are subject to changing limits, eligibility, account activation/billing requirements and potential overage charges; no vendor is guaranteed permanently free.

## Authoritative configuration and provider references

- [Lajur. self-hosting](../self-hosting/README.md) and [Windows/VPS precautions](LOCAL-VPS-ID.md)
- [Provider-high remediation](security/2026-11-16-financial-provider-hardening.md) and [installation/advisory disposition](security/2026-11-16-secure-integration.md)
- [Historical security investigation](security/2026-11-14-dependency-research.md)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare WAF](https://developers.cloudflare.com/waf/)
- [Cloudflare caching controls](https://developers.cloudflare.com/cache/)
- [Resend pricing](https://resend.com/pricing)
- [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing)
- [Restic documentation](https://restic.readthedocs.io/)
- [Healthchecks.io pricing](https://healthchecks.io/pricing/)
