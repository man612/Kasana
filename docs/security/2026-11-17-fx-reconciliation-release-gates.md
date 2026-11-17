# FX reconciliation and deployment gates — Lajur. (17 November 2026)

**Scope and evidence:** Source audit of PR #40 after the reciprocal-rate precision correction. This is a **review plan and deterministic arithmetic comparison**, not proof of a completed old/new SQL database benchmark. Repository changes do not touch actual finance data, cloud services or deployed systems.

## What the existing code will actually do

- `ExchangeRates.rate` uses `DataType.FLOAT` in the model and `DataTypes.FLOAT` in migration `20250918230000-transform-currencies-exchange-rates-schema.ts`. Sequelize's PostgreSQL mapping is generally `REAL` (single-precision), which means preserving **12 significant digits after reading** does not establish 12 significant digits of accuracy from source quotes. Verify the actual target schema before making precision guarantees.
- `getExchangeRate` derives market pairs via USD and applies `formatRate`; a qualifying per-user manual rate overrides the shared market rate.
- `calculateRefAmount` converts transaction Money, normally rounded to integer cents, then caches the result for **one hour**. Its old `ref_amount:` keys must be bypassed alongside the old four-hour `cross_rate:` keys when releasing a changed FX algorithm. PR #40 now uses `ref_amount:v2:` and `cross_rate:v2:`, leaving previous keys to expire without flushing sessions.
- Existing transactions' historical `refAmount` values are **not** backfilled by this PR. New calculations can therefore differ from stored historical conversions.
- `revalueBalanceHistory` rebuilds eligible manual foreign-currency accounts' historical `Balances` from their native cents and per-day market/custom rates. It DELETES and re-INSERTS rows in the affected date range. These are derived balance snapshots, not stored transaction `refAmount`.
- `balanceRevalueSweepCron` already executes at **18:45 UTC daily**, calling that rebuild on eligible system accounts. Therefore **deploying this formatter change can automatically alter old history without running a migration**. Account modifications can cause earlier rebuilds. Dedicated loan/vehicle flows are excluded from this generic sweep; connected-bank accounts take a today-only path.

## Exact synthetic arithmetic (not a full database comparison)

Assume a deliberately fabricated constant quote of USD 1 = IDR 16,000 and USD 1 = AED 3.6. Historical provider rates, per-day rounding and manual overrides will differ.

| Hypothetical scenario | Old 5-decimal truncation | New formatter | Difference |
| --- | ---: | ---: | ---: |
| Convert IDR 1,000,000 to USD | USD 60.00 | USD 62.50 | +USD 2.50; old is 4% below exact |
| Convert IDR 1,000,000 to AED | AED 220.00 | AED 225.00 | +AED 5.00; old is 2.22% below exact |
| Convert 2,500,000 units using a positive 0.0000004 rate | 0 | 1 | Prevents a valid rate collapsing to zero |
| Revalue a fixed IDR 1,000,000 manual account in USD | USD 60.00 history | USD 62.50 history | +USD 2.50 on each repriced identical-rate day |

These examples isolate the rate-formatter effect. They do NOT establish that real balances use these exact quotes or that additional transaction, transfer, loan and investment effects are absent.

## Mandatory old-vs-new verification on two isolated synthetic databases

| Area | Verify | Evidence as of this audit |
| --- | --- | --- |
| Rate endpoint and cache | direct, reciprocal, cross-pair, missing-rate and both v2 cache layers | Pure formatter tests and IDR/USD/AED pair E2E exist; final CI pending |
| Manual currency editor | inverse value, tiny rates, Indonesian grouping, backend custom override | Vue unit tests and previous backend tests exist; final CI pending |
| Historical FX accounts | identical native deltas but row-by-row old/new `Balances` values, missing rates and sweep idempotence | Synthetic IDR/AED balance-history E2E exists; full old-vs-new DB export **not done** |
| Transfers/split accounts | both native legs, direction, saved `refAmount`, shared ownership and balanced invariants | General tests exist; **no new comparative DB evidence** |
| Loans/pay-later | principal, installments, loan balance and payment conversion; distinct account category | Separate calculation flow identified; **no new comparative DB evidence** |
| Investments | valuation, cost basis, transaction and DECIMAL scale, portfolio currency | Different money scale identified; **no new comparative DB evidence** |
| Future nightly sweep | exact rows rewritten, idempotence, auditability and restore of pre-sweep snapshots | Scheduled rewrite confirmed from source; **no rehearsal performed** |

The test must compare identical seeded transactions on the exact pre- and post-change commits, including direct/reciprocal rates, negative balance, transaction edit/delete, split transfer, loan principal/payment, investment buy/sell, large nominal amounts and historical missing-rate days. Report old cents, new cents, source rate, quote date, manual/market origin, rounding stage and the relevant financial invariants for every changed row.

## Required operator-controlled rollout

1. **Before any public deployment**, decide whether derived historical `Balances` may be automatically revalued, and how corrections will be communicated. Do not turn on the new build until that decision is recorded.
2. Confirm the effective PostgreSQL type using a **read-only query on a disposable environment**: `SELECT data_type FROM information_schema.columns WHERE table_name = 'ExchangeRates' AND column_name = 'rate';` A migration to an exact decimal rate requires a separate, reviewed schema/performance change.
3. Restore identical synthetic seed databases independently into old/new test environments and save structured, anonymized diffs with assertions on invariants, not just test exit codes.
4. Plan a write-quiesced encrypted offsite backup and rehearse full recovery of transactions, per-user rates, derived balances and attachments. A code rollback alone **does not restore changed historical DB rows**.
5. Keep PR #40 in draft and do not merge into the umbrella candidate or deploy until the changed financial outputs are reviewed. Existing transaction values must not be silently rewritten, particularly when manually set or imported.

## Relevant source and primary references

- `packages/backend/src/services/calculate-ref-amount.service.ts`
- `packages/backend/src/services/user-exchange-rate/get-exchange-rate.service.ts`
- `packages/backend/src/services/balances/revalue-balance-history.service.ts`
- `packages/backend/src/crons/balance-revalue-sweep.ts`
- `packages/backend/src/models/exchange-rates.model.ts`
- `packages/backend/src/migrations/20250918230000-transform-currencies-exchange-rates-schema.ts`
- https://sequelize.org/docs/v7/models/data-types/
- https://www.postgresql.org/docs/current/datatype-numeric.html
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toPrecision
