# Financial-provider dependency hardening — 16 November 2026

Candidate branch: `security/lajur-financial-provider-hardening-20261116`, based on PR #32 at `b41c1d80b99345eb26aed558b296e602cc727d8f`. This supersedes the provider risk disposition in the [initial research](2026-11-14-dependency-research.md), without changing that historical checkpoint or authorizing integration/deployment. The [request-validation regression repair](2026-11-14-regression-repair.md) remains intact.

## Fresh audit evidence

Both full and production-only audits used the committed lockfiles. Package findings are not independent vulnerabilities, and full/production scopes overlap.

| Scope                            | Before C/H/M/L | After C/H/M/L     |
| -------------------------------- | -------------- | ----------------- |
| Root, full                       | 0/5/13/8 (26)  | **0/0/13/8 (21)** |
| Root, production-only            | 0/5/10/1 (16)  | **0/0/10/1 (11)** |
| Standalone docs, full            | 0/0/1/0        | 0/0/1/0           |
| Standalone docs, production-only | 0/0/1/0        | 0/0/1/0           |

The five high package entries described **two chains and two high advisories**:

- `node_modules/@polygon.io/client-js` **7.4.0** → `node_modules/query-string` **7.1.3** → `node_modules/decode-uri-component` **0.2.2**. The leaf matches [GHSA-qr28-fpjm-wq7f](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-qr28-fpjm-wq7f), fixed in **0.5.1**. The same leaf also matched moderate GHSA-vcc3-ghjq-m6fr. The three high audit entries are parent propagation, not three independent high vulnerabilities.
- `node_modules/yahoo-finance2` **3.15.2** → `node_modules/yahoo-finance2/node_modules/zod` **3.25.76**, matching [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), fixed in **4.6.6**. This was separate from Lajur.'s already-patched root Zod 4.6.7. The two high entries describe one chain.

Audit exit codes remain nonzero because moderate/low findings remain. The selected-floor guard is not a clean-audit certification; no advisory is ignored or suppressed.

## Polygon: retain the working client, bridge the fixed decoder

Registry inspection found **8.2.0** as the stable Polygon release. Its published dependencies still include `query-string: ^7.0.1`, and an unmodified isolated npm resolution produced query-string **7.1.3** / decoder **0.2.2**, so that upgrade alone retains the vulnerable chain. Unlike 7.4.0's `require`/CommonJS entry, 8.2.0 publishes an ESM entry with an `import` export condition. Lajur.'s backend builds CommonJS with external SDK dependencies. A native Node 24 loader probe returned `ERR_PACKAGE_PATH_NOT_EXPORTED` for the published 8.2.0 package. A blind major bump therefore neither fixes the advisory nor preserves its current loading contract.

`query-string` 10.0.0 removes the decoder dependency, but its published ESM entry exposes a default namespace. Polygon 7's actual CJS bundle calls the named `require('query-string').stringify`; replacing that dependency blindly is not a compatible fix.

The accepted change retains **Polygon 7.4.0 / query-string 7.1.3**, resolves the existing decoder dependency to **0.5.1**, and applies a one-line `patch-package` interoperability patch:

```diff
-const decodeComponent = require('decode-uri-component');
+const decodeComponent = require('decode-uri-component').default;
```

This is a loader bridge, not a reimplementation of URI decoding. The patched upstream decoder retains responsibility for parsing. A real Node 24 probe first reproduced `TypeError: decodeComponent is not a function` without the bridge; parse/stringify and malformed-percent tests then passed with it. The supported runtime is the repository's pinned **Node 24.22.1**, which supports synchronous `require(ESM)` for this module without top-level await. Compatibility with unsupported older Node runtimes is not claimed.

The current lock has one decoder consumer: query-string through Polygon. The exact decoder override must be reviewed if another consumer is added. The patch is tied to query-string 7.1.3; retire/revisit it when upstream provides a tested compatible fix. Polygon's optional websocket dependency `bufferutil` also resolves from 4.1.0 to 4.2.0 during the npm-generated provider-subtree resolution; it remains in the provider chain.

Backend production/build, test and development Dockerfiles copy this runtime patch before installing dependencies. The initial frontend-only `--exclude` and local failure handling were subsequently found incorrect. The [installation-security correction](2026-11-16-secure-integration.md) explicitly selects patch files, adds `--error-on-fail` and verifies the installed runtime; its evidence supersedes that initial installation claim. CI dependency-cache keys include patches and the install hook. Jest transforms the **real** ESM decoder with the existing transformer because its VM does not implement Node 24's native CJS/ESM loader; separate native tests verify actual production loading.

## Yahoo: tested v4 migration

The current stable package is **4.0.6**. The [upstream migration guide](https://github.com/gadicc/yahoo-finance2/blob/dev/docs/UPGRADING.md) requires Node ≥22 and describes no other v3→v4 API break. Its published Zod range is `npm:zod@^4.6.5`, which alone is not a security floor. The accepted lock resolves **4.6.7**, and the guard rejects versions below 4.6.6, including reintroduced Zod 3 copies. No Zod 3 remains in the root lock.

Lajur.'s provider implementation is unchanged: constructor validation options/notices, search with `validateResult: false`, quote/chart validation, six-venue ISIN fallback, local-name fallback, same-currency price-source routing, cache behavior, branded symbols, minor-unit normalization and date/adjusted-price handling are preserved. Tests cover GBp/GBX→GBP, ZAc→ZAR and ILA→ILS without introducing new conversion rules. Ordinary public request schemas still use root Zod 4.6.7; `recordId().optional()` and the non-transfer category refinement are unchanged.

## Reachability and remaining boundaries

- **Polygon:** the imported SDK's inspected transport calls query-string's **stringify**, not its vulnerable parse/decoder path. Pagination forwards the supplied next URL; it does not decode it through query-string. No other application import of query-string was found. A remotely exploitable decoder path through the current provider operations was **not established**; the vulnerable installed code is nevertheless replaced and its parsing API tested, not declared safe because it appears unused.
- **Yahoo:** the old package's inspected Zod import was `zod/v4` in its bundled `script/src/mcp/server.js`. Lajur. imports the default Yahoo client and does not expose Yahoo's bundled MCP server. Its own MCP integration is separate and uses the already-patched application Zod/SDK. The package finding did not prove an unauthenticated exploit through ordinary search/quote/chart calls. Removal of the affected nested package still prevents accidental future exposure.
- Investment routes authenticate sessions before invoking providers. The security-search schema requires a nonempty scalar query, with no application-level maximum length. Ordinary JSON bodies use Express's default 100 KiB limit; larger import/backup exceptions are unrelated. Those inbound bounds **do not cap provider HTTP response bodies**.
- Yahoo requests six search quotes by default with news disabled, resolves currencies in batches of five and caps extra local-ISIN candidates at six. Those are request/concurrency controls, not a guarantee that a malformed upstream response obeys its requested count. Search result validation remains intentionally disabled for evolving UCITS metadata; quote/chart validation remains enabled. No speculative response truncation, schema relaxation or new financial behavior was introduced. Polygon's existing retry branch recognizes Axios 429 errors; its SDK's own HTTP errors still propagate as before, which the runtime contract checks. This is not a claim that those SDK errors receive automatic retries.
- The remaining Hono, fast-uri, Astro and other moderate/low findings require separate reachable-path review. Existing Jest teardown/open-handle warnings, icon-distribution permissions, real Windows Podman and physical-device checks remain separate release/deployment concerns.

## Verification and reproducibility

All provider tests use synthetic responses: a loopback Polygon HTTP server with a synthetic key, injected Yahoo fetch/cookie/crumb responses and a fail-closed default fetch. No live keys, paid calls, production database or workstation/VPS resources are used.

- `npm ci` passed for root and standalone docs; the docs lock is unchanged. Lock versions were generated by npm, not substituted manually. Existing-tree npm 11 lock-only attempts retained the old decoder. A temporary npm 10.9.5 resolution produced the accepted lock; comparing every entry against the Yahoo-only candidate showed only decoder/bufferutil changes beyond that provider subtree. The complete npm-generated lock was copied unchanged and a clean install using the normal npm 11 runtime passed.
- **19 provider unit cases** cover initialization, grouped/individual historical data, previous close, search/type/currency mapping, defaults, empty/partial/malformed responses, rate-limit/failure handling, ISIN fallback, caches and bulk security-ID routing. The focused Jest run has **20 tests**, including its native-runtime wrapper.
- **10 native Node contracts** exercise the actual locked packages: CJS/ESM loading, parse/stringify, the advisory's malformed-run payload, authentication, aggregates, previous close, details, forex passthrough, pagination, errors, Yahoo constructor/search/quote/chart behavior and patched Zod's oversized-array rejection. The same contracts also passed in an isolated Node container with networking disabled and synthetic loopback HTTP only.
- Guard regressions reject decoder 0.2.2/0.4.3/0.5.0 and reintroduced Zod 3. Existing Undici checks and all original financial assertions remain.

Run the native contracts with `npm -w packages/backend run test:provider-runtime`; run the provider/Jest wrapper with `npm -w packages/backend run test:unit -- --runInBand --testPathPattern='(tests/runtime/financial-providers|data-providers/(polygon|yahoo)-provider)\.unit'`.

Production frontend/backend builds, typechecks, lint, focused frontend amounts and the remaining local/cloud checks are recorded in the security PR with observed final-SHA CI results. Do not infer final-head CI success from this document. The local Cloud Docker VFS build exhausted disk while copying its layers, before dependency installation; only task-created dependency backup/cache entries were reclaimed. An unrelated 17-case upload-cache unit suite was rerun successfully after its ENOSPC failures. Local HTTP verification uses a new `bt-test-lajur-provider-e2e-20261116` namespace with candidate source/installed dependencies mounted into a task-owned runner; existing databases and volumes are untouched. The final focused HTTP run passed **138 tests / 1 todo in 8 suites**, after matching the synthetic admin fixture to CI (`test1`). Both production builds, separate backend/frontend typechecks, lint, 211 focused frontend amount tests and 16 script regressions passed. The broad local backend unit attempt had **3,757 passed / 16 ENOSPC failures / 104 skipped**; the affected 17-case upload-cache suite then passed after disk recovery. A fresh full CI unit run and image build remain independent final-head gates.
