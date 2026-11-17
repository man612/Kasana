# Lajur. public release — clean-install readiness

**Operating assumption, 17 November 2026:** The current account/transaction data are dummy-only. That is supplied by the operator, **not verified** by inspecting a machine, VPS or database. This proposal targets a **brand-new, empty production database**; it neither resets existing test accounts nor moves any old volumes.

## What can be skipped, what cannot

A brand-new public database has no old ledger to migrate, so a complete old/new comparison of previously stored dummy cents is **not required for that clean install**. [Issue #45](https://github.com/man612/Kasana/issues/45) remains open for later upgrades of real/nonempty databases. All new financial calculations, transactions, FX, transfers, split accounts, loans, investments, user isolation, attachments, authentication, backups and browser UX **still must be tested**.

The existing nightly foreign-account balance sweep can rewrite derived historical balances after a future deployment. Once actual users sign up, code rollback alone cannot restore those rows. Enable backup and verify recovery **before** registration opens.

## Gate A — prove the public database is genuinely new

1. Keep public signup closed until the following gates pass. A desired setting is SYSTEM_MAX_SIGNUPS_ALLOWED=0, but inspect the effective runtime setting and behavior rather than trusting a template.
2. Create an intentionally separate new Compose/Portainer stack, PostgreSQL volume, Redis namespace and attachment/object-storage namespace. Do not rename the existing Compose project or attach existing volumes: changing a project name can make existing volumes seem to vanish without migrating them. Do not import old user test data into the public instance.
3. Apply application migrations to the **new isolated database**. In a trusted operator terminal, after verifying the connection target, run the *read-only* gate:

       psql -X -v ON_ERROR_STOP=1 "$NEW_ISOLATED_DB_URL" -f scripts/finance-fresh-install-readonly.sql

   It uses a REPEATABLE READ READ ONLY transaction, 5-second statement timeout, 2-second lock timeout, and SELECT EXISTS on Users, Better Auth users/sessions, accounts, transactions, balances, attachments and per-user FX data. It prints no identifiers or money:
   - EMPTY_APP_DATA_CANDIDATE_ONLY: those database tables have no rows; this is a necessary condition, **not** a standalone release approval.
   - NOT_EMPTY_STOP_AND_REVIEW: **stop** and choose a new isolated database, or follow the nonempty upgrade path. Do not DROP, TRUNCATE, DELETE or reset anything automatically.
   - SQL error/missing table: stop and inspect the schema on disposable infrastructure; missing is not equivalent to empty.
4. SQL does not verify volumes, filesystem attachments, Cloudflare R2/B2, Redis state, actual container settings or outside account credentials. Check those separately in a trusted terminal, and never paste credentials or private data into GitHub logs or chat.

## Gate B — source and UX verification

- [x] Exact FX candidate CI 20/20 PASS at https://github.com/man612/Kasana/actions/runs/44037442804; seven BigInt cents-diff tests and currency history regressions pass.
- [ ] Final umbrella PR #10 SHA passes all application CI, docs, dependency review, and synthetic encrypted recovery checks. Recheck after every code change.
- [ ] Synthetic two-user authorization check: A must not read, download, export, change or delete B's transactions, accounts, reports, shared resources or private attachments.
- [ ] Test income/expense/transfer/split, native and reference cents, manual/live FX, historic edits and deletions, loans/payments, investments/trades/fees, imports/exports, balances on missing-rate days, and the nightly sweep's repeatability.
- [ ] Verify Windows Podman and real browsers: desktop/mobile layout, 80% zoom, forms, anchored dropdowns, modals, animation/reduced-motion, navigation/back buttons, and Indonesian error messages.

## Gate C — actual public hosting acceptance

- [ ] Validate effective Compose and optional stack.env + Portainer-injected config without printing real secrets. Confirm identity URLs, secrets, actual signup cap, DB credentials and disable all demo accounts.
- [ ] HTTPS, DNS and Cloudflare Tunnel work; backend origin, PostgreSQL and Redis cannot be reached directly from the internet. Test forwarded-IP trust and rate limiting.
- [ ] Cloudflare Cache Rules **and Cache Response Rules** are inspected in the real zone. Using separate dummy logged-in users, repeatedly request finance API and attachments and confirm response isolation and CF-Cache-Status. Origin Cache-Control alone is insufficient where an edge rule overrides it.
- [ ] Resend sender DNS is verified and actual email verification, resend, forgot-password, signout, account limits, login and passkey origin are tested.
- [ ] Run relevant npm/container dependency and image provenance reviews. Pin the actual inspected currency-provider image digest rather than pulling an unreviewed mutable latest tag.
- [ ] Configure encrypted offsite backup of database **and** attachments and successfully restore to a clean independent environment; test failures/alerts and privacy-safe canary. Passing a synthetic GitHub restore alone does not verify real B2 credentials or R2 object coverage.
- [ ] Monitor VM disk/RAM, service restarts, CPU/query load, registration abuse, exceptions, alerting and incident contact with a small staged synthetic workload. Avoid expensive bulk imports on the user's local VM.

## Gate D — public operator responsibilities

- [ ] Confirm operator identity/contact, accurate privacy notice and terms, data types, retention/deletion, third-party subprocessors, cross-border transfer, user rights and incident response. Inherited boilerplate is not an operator-specific notice.
- [ ] Evaluate Indonesian PSE Lingkup Privat registration criteria for the actual public service and operator. A bookkeeping app is not necessarily a regulated bank, but public online services and personal-data handling can create registration and privacy duties; do not assume exemption without appropriate local advice.
- [ ] Preserve GNU AGPLv3 corresponding-source access and upstream attribution. S-curve artwork provenance/permission is still unverified: obtain an original creator/license record or properly replace the artwork before the public brand launch.
- [ ] Communicate limitations: no automatic Indonesian bank/e-wallet integration unless separately proved, historical exchange quotes may be approximate, and the app is financial bookkeeping rather than guaranteed financial advice.

## Gate E — rollout sequence

1. Local/private staging with synthetic users only; public registration off.
2. Isolated internet-facing preview protected by authentication; test two-user privacy and Cloudflare cache behavior.
3. Invitation-only beta, only after A–D are accepted and recovery has succeeded.
4. Public registration after a deliberate operator go-live decision. Once real data exists, issue #45's old/new comparison is required for consequential money-calculation upgrades.

**Current status:** source and CI preparation only. No physical-device Podman, Cloudflare account, Resend delivery, PSE/legal status, actual production storage emptiness or offsite recovery is confirmed by this document.

## Primary references

- [Public Option B architecture/deployment review](2026-11-17-public-option-b-deep-audit.md)
- [Finance reconciliation and historical sweep gates](2026-11-17-fx-reconciliation-release-gates.md)
- https://pse.komdigi.go.id/panduan/kriteria-pendaftaran-pse-lingkup-privat
- https://jdih.kemenkeu.go.id/dok/uu-27-tahun-2022/overview
- https://developers.cloudflare.com/cache/how-to/cache-response-rules/
- https://www.gnu.org/licenses/agpl-3.0.en.html
