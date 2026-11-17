# Correctness of converted nominal amounts after FX edits — 17 November 2026

**Scope:** Candidate fix stacked on draft [PR #40](https://github.com/man612/Kasana/pull/40) to address [issue #41](https://github.com/man612/Kasana/issues/41). No changes to stored financial data, schema, VPS, Podman, or deployed services.

## Problem verified by code flow

`calculateRefAmount` previously cached **rounded monetary cents** for one hour as `ref_amount:v2:<userId>:<amountCents>:<from>:<to>:<date>`, before it called `getExchangeRate`. This key has no active-rate revision. Editing/removing a user's custom rate or toggling `liveRateUpdate` changes the effective conversion immediately, but a previously cached nominal could bypass the rate lookup and serve the old amount. The global `cross_rate:v2` rate cache is distinct: `getExchangeRate` checks owner permissions and manual rate overrides before reading it.

Blindly deleting all matching nominal keys after an edit is not a proof of correctness: an in-flight conversion can repopulate an old value after deletion; an after-commit Redis failure likewise leaves stale cents until TTL. Redis itself documents both failure modes (see sources).

## Narrow fix

- Remove the **outer converted-amount Redis cache** on this calculation path. Do not cache whole money amounts when the upstream per-user rate can change.
- Retain `getExchangeRate`'s four-hour global **market cross-rate cache**, which is checked only after the user connection/custom override lookup. Currency equality remains an in-memory early return.
- Keep `bypassCache` as the existing explicit way to bypass the *market-rate cache* during immediate spot remeasurement and rate updates; no extra Redis keyspace scans or cross-user eviction.
- Regression E2E injects a deliberately stale `ref_amount:v2` key and checks market→manual edit→manual edit→live toggle→manual toggle→manual removal. The old implementation would reuse 6,000 cents; the expected synthetic values are 22,500, 30,000, and 40,000 cents in AED.

## Trade-off and verification

A cache hit for a repeated nominal now requires `getExchangeRate` and its user-connection check instead of directly returning cached cents. This can increase backend SQL reads during high-volume imports, although the global cross-rate remains cached. Benchmark E2E bulk-import throughput and query count before any public rollout; **correctness is prioritized over an unversioned financial amount cache**.

This fix does not guarantee market quotes are fresh within the existing four-hour `cross_rate:v2` TTL if an exact-date upstream quote itself changes. That is a separate freshness policy and needs measured tests. It also does not reconcile historical transaction `refAmount` or upgrade PostgreSQL `ExchangeRates.rate` from its declared FLOAT type.

Primary references:
- https://redis.io/blog/cache-consistency-strategies/
- https://redis.io/docs/latest/develop/use-cases/cache-aside/
- https://sequelize.org/docs/v6/other-topics/transactions/

Community counterexamples (not authoritative):
- https://stackoverflow.com/questions/78751791/cache-deletion-and-refreshing-data-race
- https://www.reddit.com/r/PostgreSQL/comments/113s3kg/best_representation_of_currency_in_postgres/
