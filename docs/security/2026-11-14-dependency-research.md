# Dependency-security investigation — 14 November 2026

**Status:** proposed fixes on `security/lajur-advisory-patches-20261114`; no merge, production deployment, or local Podman update.

This investigation uses the exact two committed npm lockfiles for the active Lajur. feature branch. Source code and primary vendor advisories were reviewed. Advisory matches are **not** proof of exploitability, and the runtime/all-dependency scans overlap. Do not sum the rows.

## Evidence: actual before and after npm audits

| Lockfile scope | Baseline C/H/M/L (total) | Patched C/H/M/L (total) | Change |
| --- | --- | --- | --- |
| Root workspaces — all | 1/13/13/8 (35) | 0/5/13/8 (26) | 9 fewer |
| Root workspaces — runtime only | 1/13/10/1 (25) | 0/5/10/1 (16) | 9 fewer |
| Standalone docs — all | 0/2/1/0 (3) | 0/0/1/0 (1) | 2 fewer |
| Standalone docs — runtime only | 0/2/1/0 (3) | 0/0/1/0 (1) | 2 fewer |

- Baseline workflow: [43593287723](https://github.com/man612/Kasana/actions/runs/43593287723).
- After core patches: [43596183876](https://github.com/man612/Kasana/actions/runs/43596183876).
- After follow-redirects patch: [43596560961](https://github.com/man612/Kasana/actions/runs/43596560961).
- The automated patch guard `scripts/security-lockfile-check.mjs` validates specific minimums, not a full security assessment.

## What was patched

| Installed dependency | Old | Updated resolved version | Reason and status |
| --- | --- | --- | --- |
| dompurify (via posthog-js) | 3.4.16 | 3.4.17 | CVE-2026-116804, shadow-root/template and related IN_PLACE protections |
| body-parser (via Express 4) | 1.20.8 | 1.20.9 | CVE-2026-111181: compressed request body can crash Node |
| body-parser (via MCP SDK Express 5) | 2.3.0 | 2.4.0 | Same CVE, separate major line |
| vue-i18n / @intlify | 11.4.4 | 11.4.20 | Sanitize `srcdoc` and escape named/list interpolation; related patches |
| zod (backend workspace) | 4.3.6 | 4.6.7 | CVE-2023-54404, unbounded array-validation issue; backend manifest raised to `~4.6.7` |
| undici / npm dependency copies | 6.29.0, 7.30.1, 8.10.2 | 6.29.1, 7.30.2, 8.12.4 | Multiple fixes in maintained major lines |
| follow-redirects (via axios) | 1.16.1 | 1.16.3 | CVE-2026-116689 sensitive-header redirect handling |
| docs undici / zod | 8.11.0 / 4.6.5 | 8.12.4 / 4.6.7 | Vulnerable nested docs versions resolved |

The lockfiles were **regenerated using npm in isolated GitHub Actions jobs**, not edited by hand. Only the backend Zod range in a dependency manifest was changed intentionally. The new lockfiles still need full installation/build/tests before this work can be merged.

## Source-based reachability assessment

**body-parser — higher priority, plausible externally reachable DoS.** In `packages/backend/src/app.ts`, `setupMiddleware(app)` runs before `setupRoutes(app)`. In `setup-middleware.ts`, global `express.json()` and `express.urlencoded()` are configured outside the authentication and binary-route exceptions. The advisory describes an unauthenticated request that can crash a parser if `inflate` remains enabled. The fixed dependency is the preferred remedy. Consider `inflate: false` as defense-in-depth only after verifying whether compressed imports or webhooks are actually supported; doing so changes accepted requests.

**Vue I18n — dependency vulnerable, exploit conditions not established.** `packages/frontend/src/i18n/index.ts` creates the i18n instance with a custom resilient message compiler, but does not enable `escapeParameter` in the inspected configuration. The specific `srcdoc` advisory requires escaped parameters plus an HTML translation rendering/untrusted input pattern. This is not confirmation that all rendering surfaces are safe; the compatible family patch was applied.

**DOMPurify — critical package match, specific configuration requirements.** The root lockfile's vulnerable DOMPurify copy came from `posthog-js`. The frontend `lib/posthog.ts` enables PostHog only in production **when a key is configured**. The shadow-root template advisory requires special sanitizer flags and a downstream template engine, not simply installing the library. These conditions were not established for Lajur., but the patch should remain even where PostHog is disabled.

**Undici — different copies/contexts.** The root lockfile previously included 6.x, 7.x and 8.x trees; the docs lockfile independently included 8.11.0. All affected major lines were raised to the tested patch minimums. Some advisories require WebSockets/HTTP2, redirects, caching or particular TLS connections; assess each actual use separately.

**Finance data providers — unresolved.** `YahooDataProvider` uses `yahoo-finance2@3.15.2` (through a nested `zod@3.25.76`) for `search`, `quote`, `chart` and ISIN fallbacks. `PolygonDataProvider` uses `@polygon.io/client-js@7.4.0`, which depends on `query-string@7.1.3` -> `decode-uri-component@0.2.2`. These are actual imported integrations, not merely unused packages.

## Remaining high-severity dependency chains — DO NOT force overrides

1. **Polygon -> query-string 7.1.3 -> decode-uri-component 0.2.2.** Advisory [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) identifies a quadratic-time denial of service, fixed in decode-uri-component 0.5.1. But the fixed decoder is ESM-only, while query-string 7 is CommonJS. Forcing an npm override to 0.5.1 can break `require()` and Polygon functionality. Inspect the current Polygon client 8.x and its release notes and API compatibility, or replace the client usage with a separately tested implementation. Include `restClient`, `aggregatesGroupedDaily`, `aggregates`, `previousClose`, `tickerDetails`, historical parsing and rates in tests. Do not drop query parsing features blindly.
2. **Yahoo Finance -> Zod 3.25.76.** [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) marks versions below 4.6.6 as affected for certain oversized array validation paths. The new `yahoo-finance2` 4.x line reportedly migrates its Zod dependency to 4.x and requires Node >=22 (the repository's `.nvmrc` is Node 24.22.1). Despite a narrow upstream upgrade guide, Lajur. uses constructor options, `validateResult: false`, custom currency handling and ISIN lookup fallback. Do not upgrade or remove its nested Zod 3 with an override without synthetic integration tests for these flows.

These five remaining npm audit high-severity package matches come from the two dependency chains above; they do **not** represent five independent exploit paths.

## Medium and lower severity backlog

The remaining root audit also flags `@hono/node-server`, `hono`, `fast-uri`, `qs`, `astro`, `minimatch`, `ip-address`, `editorconfig`, Sentry's bundler plugin chain, and several lower-severity test dependencies. Examples:
- `@hono/node-server@1.19.17` is below 1.19.18, which patches path normalization [GHSA-jpvv-r467-5p4w](https://github.com/advisories/GHSA-jpvv-r467-5p4w). Hono's various advisories have different ranges and mitigations; do not equate a newer version with zero risk for every feature.
- `fast-uri@3.1.8` is below 3.1.9 for [GHSA-wjr9-j795-jxcr](https://github.com/fastify/fast-uri/security/advisories/GHSA-wjr9-j795-jxcr).
- The standalone docs now have one moderate `astro` finding; its exact advisory, runtime reachability and patch should be verified before upgrading Astro.
- Test-only libraries can have real vulnerabilities but should be triaged separately from network-facing runtime paths.
- A vulnerability scan can report direct parent packages as vulnerable because they depend on one vulnerable child. Count package matches and independently reachable exploit chains separately.

## Acceptance requirements before deployment

1. Open a **separate draft security PR** into the active feature branch; do not mix it with housekeeping PR #24 or merge into `main`.
2. Confirm `npm ci` for root and docs, full backend/frontend lint and typechecks, unit and relevant E2E tests, and built-image smoke tests. Pay special attention to auth, compressed requests, investment providers, locale switching and transaction validation.
3. Verify the exact locked versions and rerun full and production-only audits. Remaining 26/16 root and 1 docs findings are **unresolved**, not suppressed.
4. Retain original `LICENSE`, attribution, database schema and financial transaction invariants.
5. Do not restart local Podman or touch production until the user-controlled computer is accessible and the generated application images pass the verification gates. This is a GitHub-only research/patch checkpoint.

## Primary references

- [Express body-parser advisory GHSA-27r3-jxmh-p828](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
- [Vue I18n advisory GHSA-83rm-6c8r-g728](https://github.com/intlify/vue-i18n/security/advisories/GHSA-83rm-6c8r-g728)
- [DOMPurify advisory GHSA-cg2g-xh64-v4q7](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7)
- [Undici advisories and releases](https://github.com/nodejs/undici/releases)
- [Follow-redirects advisory GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)
- [Zod advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [Yahoo Finance v4 migration guide](https://github.com/gadicc/yahoo-finance2/blob/dev/docs/UPGRADING.md)
