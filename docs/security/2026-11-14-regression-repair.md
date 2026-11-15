# PR #26 — Zod request regression and security-guard repair

The starting head was `96b2e3c8c24312c1f9cfd8f4897c4f78e1570039` on `security/lajur-advisory-patches-20261114`, based on `82f3812`. PR #24 and #27–#31 remain separate; this repair does not merge, retarget or deploy any PR.

## Transaction category contract

`createTransactionBodyShape.categoryId` used `z.union([recordId(), z.undefined()])`. Under patched Zod 4.6.7, an explicitly undefined in-memory key is accepted but an absent key is rejected. JSON removes undefined properties. Both failing shard-2 fixtures POST an uncategorized loan payment with that property omitted on the wire.

The smallest fix is `recordId().optional()`. It retains the UUID-to-`RecordId` transformation, optional inferred request property and `RecordId | undefined` output. The existing non-transfer refinement still requires a category; null, malformed IDs, missing transfer destinations, invalid commissions and transfer splits remain rejected. No transaction service, amount conversion, balance calculation or dependency version is changed.

The new real-schema unit suite failed before the fix (3 failures / 11 tests): omitted and JSON-serialized undefined loan-payment categories, and the expected non-transfer category refinement (which the required-key error prevented). This is a test-first reproduction against the application schema, not a reduced substitute.

The isolated real endpoint reproduced **HTTP 422** with:

```json
{
  "status": "error",
  "response": {
    "message": "body.categoryId: Invalid input: expected nonoptional, received undefined",
    "validationErrors": [{ "code": "invalid_type", "expected": "nonoptional", "path": ["body", "categoryId"] }]
  }
}
```

This excerpt omits the redundant issue message and response code. The pre-fix HTTP run completed: **3 failed suites; 4 failed / 37 passed tests** (the two original fixtures and the absent/undefined creation cases failed). The fixed host source was then copied into **only the task's test-runner container**, with its schema SHA-256 checked against the checkout; the dependency image and Zod 4.6.7 stayed unchanged. The second run uses the same harness and isolated services.

The existing `makeRequest` helper's `raw: true` simply extracts `body.response`; it does not assert HTTP success. Its global behavior remains unchanged because many negative tests intentionally inspect errors. The two aggregate fixtures and new transaction E2E tests use the existing typed HTTP helper with explicit response status, envelope and transaction-ID assertions before accessing returned legs or checking balances. The original budget pool `-300`/`700`/zero-drift and cumulative `150` assertions remain intact.

## Optionality audit

A targeted search of controller/request schemas found one remaining unwrapped `z.undefined()` union: the transaction category above. Category creation and holding creation already use explicit `.optional()` on their absent alternative branches in this PR. New public-schema tests cover root/child category requirements, both holding source alternatives and their mutual exclusion, required account currency, create defaults and PATCH omission. Existing loan schema tests cover omitted optional amounts and Money transformations.

Transaction update fields use explicit `.optional()`/`.nullish()` and do not inject create defaults. The refund `originAmount` preprocessing schema wraps an optional inner number; a Zod 4.6.7 probe accepts the omitted key. Pagination/create defaults remain intentional. The financial-import extraction preprocessor normalizes its request object and retains its required fields. No speculative optionality changes were applied elsewhere.

## Verified security floors

Minimum patched versions come from the linked advisory's affected range, not the installed package version. The root and standalone docs lockfiles remain byte-for-byte unchanged.

| Dependency / line                                     | Guard floor         | Evidence                                                                                                                                                                                                         |
| ----------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOMPurify 3                                           | 3.4.17              | [Vendor GHSA-cg2g-xh64-v4q7](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7)                                                                                                        |
| body-parser 1 / 2                                     | 1.20.9 / 2.4.0      | [Vendor GHSA-27r3-jxmh-p828](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)                                                                                                   |
| follow-redirects 1                                    | 1.16.2              | [Vendor GHSA-mrwp-f3q8-3g9p](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-mrwp-f3q8-3g9p); installed 1.16.3 is retained                                                         |
| vue-i18n, @intlify/core-base, @intlify/shared 11      | 11.4.14             | [Vendor GHSA-83rm-6c8r-g728](https://github.com/intlify/vue-i18n/security/advisories/GHSA-83rm-6c8r-g728) and [GHSA-8rc2-428q-7ww3](https://github.com/intlify/vue-i18n/security/advisories/GHSA-8rc2-428q-7ww3) |
| @intlify/message-compiler, @intlify/devtools-types 11 | 11.4.14             | Existing **family compatibility floors**, not independent affected packages named by that advisory; installed 11.4.20 family versions are retained                                                               |
| Undici 6                                              | 6.29.1              | [Vendor GHSA-2m5v-pch6-74hx](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx), also the October DoS advisory series                                                                     |
| Undici 7 / 8                                          | **7.30.2** / 8.12.4 | [Vendor GHSA-mqg3-3v4r-cm32](https://github.com/nodejs/undici/security/advisories/GHSA-mqg3-3v4r-cm32), published 5 November 2026; 7.30.1 remains affected                                                       |
| Zod 4                                                 | 4.6.6               | [Reviewed GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) and [upstream release 4.6.6](https://github.com/colinhacks/zod/releases/tag/v4.6.6); installed 4.6.7 is retained               |

The guard now exposes its checking function for synthetic in-memory lockfile tests. Tests reject 7.30.1 at each real root Undici 7 location, reject its older patch and prerelease, accept the exact 7.30.2 floor, check standalone-docs nesting separately, and retain explicit unknown-major and unresolved Zod 3 reporting. No new dependency is needed. CI runs both the guard and its regression tests.

Fresh `npm audit --json` reports **root: 0 critical, 5 high, 13 moderate, 8 low (26 total); standalone docs: 0 critical/high, 1 moderate**. These scopes overlap; no advisory is suppressed. Polygon → query-string → decode-uri-component and Yahoo Finance → Zod 3 remain unresolved high-severity chains, with the existing Hono/fast-uri/Astro and other moderate/low backlog described in [the dependency research](2026-11-14-dependency-research.md). This targeted guard is not a vulnerability-free certification.

## Isolated execution and harness behavior

The existing Docker test harness uses project `bt-test-kasana`, separate test-only PostgreSQL/Redis volumes and an internal network. Before running it, no containers or volumes with that project name existed. The pre-existing `kasana-postgres` and `kasana-redis` containers were not started, stopped, reconfigured or inspected for data. A new gitignored `.env.test` was created with synthetic credentials, test hostnames and dummy provider keys; no existing configuration was replaced. `CI=1` avoids the harness's local automatic volume/image cleanup.

The ordinary image build first failed during npm installation with `SELF_SIGNED_CERT_IN_CHAIN`, before any E2E execution. Following the Cloud runtime guidance, a temporary Dockerfile mounts the environment's trusted CA as a BuildKit secret during `npm ci`. TLS verification stays enabled, the CA does not enter an image layer, and the committed Dockerfile and dependencies remain unchanged.

The harness now stops when Compose startup/build fails and reports **every** nonzero test exit as failure, preserving the exit code. Six tests execute the actual harness against a fake Docker CLI in temporary synthetic directories, covering runner exits 0, 1, 2, 134 and 137 plus startup failure. No real container or database is used by those tests.

## Verification completed

- **PASS:** root `npm ci` (1,703 installed packages) and standalone docs `npm ci` (388); lockfiles unchanged.
- **PASS:** focused real-schema/MCP/loan/account tests, **101 tests in 6 suites**.
- **PASS:** full backend unit run, **3,753 passed / 104 skipped tests**, 237 passing suites and one skipped suite; `NODE_OPTIONS=--max-old-space-size=3072 npm -w packages/backend run test:unit -- --runInBand`.
- **PASS:** focused HTTP E2E run, **42 tests in 3 suites**, including the two originally failing files and seven new endpoint cases. No skipped tests in this focused run.
- **PASS:** broader HTTP E2E run, **155 passed / 1 todo in 6 suites**, covering account create/update, transaction creation/category ownership, loan-payment linking, holdings and CSV import. The existing harness uses Jest `--forceExit`; this broader run emitted a worker teardown warning and exited 0. Do not treat that warning as proof that open-handle cleanup is complete.
- **PASS:** final root `NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck`, covering both backend and frontend.
- **PASS:** security guard and shell-harness regressions, **13 tests**, plus selected lockfile floors. Fresh root/docs audits completed with **nonzero advisory results**; their remaining findings are reported above, not suppressed or marked clean.
- **PASS:** backend/frontend lint and i18n-key check (existing warnings retained), public identity guard, safe Compose boundary validation, Bash syntax, and changed-file formatting/whitespace checks.

Focused HTTP command (from the repository root, after preparing an isolated synthetic test env):

```bash
CI=1 TEST_RUNNER_IMAGE=bt-test-kasana-test-runner npm -w packages/backend run test:e2e -- --testPathPattern='(budget-plans/pool|stats/get-cumulative-data|transactions/category-optionality)\.e2e'
```

`TEST_RUNNER_IMAGE` here identifies the task-only image described above; other environments may use the harness's normal build. The fixed source was copied to that isolated runner before this invocation. Full application CI, image-build verification and review on the final published SHA remain integration gates; an earlier green run does not certify a later commit. No real installation or VPS was exercised.

The full frontend unit run (`NODE_OPTIONS=--max-old-space-size=3072 npm -w packages/frontend run test:unit -- --run --pool=threads --maxWorkers=2`) **completed successfully in 617.71 seconds**: **4,208 passed / 34 skipped tests**, 318 passing files and one skipped file. A separately selected compiler/i18n/loading/amount-formatting run also passed **58 tests in 5 files**. All skips and the broader E2E todo are reported rather than counted as passes. Full backend E2E across every repository suite, production image builds, live providers, workstation and VPS checks were **NOT RUN** by this repair.

After E2E verification, only the task-created `bt-test-kasana-*` containers were explicitly stopped; their synthetic volumes were retained. The runner container's tail process was stopped after Jest had returned success; container stop status is not a test exit code. The pre-existing `kasana-*` containers remained untouched and stopped throughout.

## Changed files

- `packages/backend/src/controllers/transactions.controller/schemas.ts`: make the category key explicitly optional; retain all refinements.
- `packages/backend/src/controllers/transactions.controller/schemas.unit.ts`: 11 real-schema category/default/refinement regressions.
- `packages/backend/src/controllers/request-optionality.unit.ts`: 4 category/holding/account JSON-omission contract tests.
- `packages/backend/src/services/transactions/category-optionality.e2e.ts`: 7 real endpoint cases covering absence, undefined-before-JSON, valid and malformed categories, persisted transfer legs and unchanged/correct balances.
- `packages/backend/src/services/budget-plans/pool.e2e.ts` and `packages/backend/src/services/stats/get-cumulative-data.e2e.ts`: assert successful HTTP status, response envelope, IDs and uncategorized legs before the existing totals.
- `scripts/security-lockfile-check.mjs` and `scripts/security-lockfile-check.test.mjs`: corrected Undici floor, importable check seam and 7 lockfile regressions.
- `packages/backend/src/tests/setup-e2e-tests.sh` and `scripts/setup-e2e-tests.test.mjs`: fail immediately on startup errors and report all nonzero runner exits correctly, with 6 fake-CLI tests.
- `.github/workflows/check-source-code.yml`: run the security guard and both script regression suites before dependency installation.
- This report: reproduction, advisory evidence, safety scope and actual verification results.
