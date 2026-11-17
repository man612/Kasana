# Lajur. finance audit — reciprocal FX precision for IDR and other small currencies

**Status:** Isolated draft candidate. No deployment or migration has been performed, but deploying the changed formatter later can automatically rewrite historic `Balances` via existing scheduled jobs. Reviewed source: PR #10 SHA ffc793a6b74d2da9f4887317533c4b03face5c90, 17 November 2026.

## Reproduced source flaw

In packages/backend/src/services/exchange-rates/build-daily-pair-rate-resolver.ts the shared formatter previously used:

    Math.trunc(rate * 100000) / 100000

The same function is imported by packages/backend/src/services/user-exchange-rate/get-exchange-rate.service.ts, which converts through USD for direct/reciprocal and non-USD currency pairs, and formats user-defined manual conversion rates. Foreign-currency daily-balance history calls the formatter too.

Because it truncates to FIVE digits **after the decimal point** rather than preserving significant digits, the relative error grows dramatically for small positive rates:

| Synthetic fixed-rate case | Mathematically correct | Existing formatter | Financial impact |
| --- | ---: | ---: | --- |
| USD/IDR 1:16,000; 1 IDR to USD | 0.0000625 | 0.00006 | 4% lower, Rp1,000,000 valued at $60 rather than $62.50 |
| USD/IDR 1:16,000; 1 IDR to AED (USD→AED=3.6) | 0.000225 | 0.00022 | ~2.22% lower |
| Synthetic one unit to 1/2,500,000 of another | 0.0000004 | 0 | Conversion/history can collapse to zero or report missing despite positive data |
| USD/IDR 1:16,000; USD to IDR | 16000 | 16000 | No error for this exact integer rate |

These are deliberately constructed TEST FIXTURES, NOT current central-bank quotes. Relative currency precision is distinct from the display scale/minor units of a currency. Keeping two decimal places on a USD *amount* does not justify truncating the underlying reciprocal FX *rate* to five decimal places.

## Narrow prospective correction

- Retain 12 significant digits rather than five fractional digits with Number(rate.toPrecision(12)). This preserves small reciprocal and cross rates without forcing a fixed number of decimals for every currency.
- Both live API getExchangeRate and daily balance-history calculations already call the shared formatRate helper; no dual-formula drift is introduced.
- Version both Redis cache layers: `cross_rate:v2` for rates (four-hour TTL), **and** `ref_amount:v2` for converted monetary amounts (one-hour TTL). Otherwise existing converted amounts could still contain the old five-decimal error after rate-cache versioning. Old keys expire without a flush or forced logout.
- Add pure unit tests for IDR/USD, tiny positive rates, an ordinary pair and invalid/zero handling, plus backend E2E tests for IDR→USD/IDR→AED rates and an IDR account's historical balance using controlled historical USD-pivot rows.
- Fix the frontend manual inverse-rate calculator, which separately rounded to **six decimal places** and could change 0.0000625 into 0.000063 or turn smaller rates into zero. Preserve 12 significant digits while editing.
- Fix the currency-list display that previously used six fractional digits and could conceal meaningful low-value FX precision. Use significant digits only for tiny rates, keeping ordinary rows compact. Add Vue/Vitest tests for reciprocal editing and Indonesian locale display.
- Document the new accuracy contract in docs/specifications/foreign-currency-balance-history.md.

### What this does NOT solve automatically

Both the `ExchangeRates.rate` model and the 2025-09-18 migration declare Sequelize `FLOAT`. Contrary to the initial code-only assumption that this meant PostgreSQL `REAL`, an **actual migrated disposable E2E PostgreSQL probe** (CI 44033608543, shard 3) showed `ExchangeRates.rate` and `UserExchangeRates.rate` as `double precision` (IEEE 754 binary64, about 15 significant decimal digits). Existing `Transactions.refAmount` and `Balances.amount` are `bigint` cents. Twelve significant output digits cannot restore provider/source precision already lost, and floating point remains inexact; no type migration should be made without observing a real target schema and quantitative error evidence. The schema, minor units and historical transaction `refAmount` are not migrated. **The existing nightly `balanceRevalueSweepCron` at 18:45 UTC and account write paths can automatically delete/rewrite qualifying old `Balances` rows after a future deployment.** A finance-data comparison and rehearsed rollback must precede any such deployment.

Merely creating this PR changes no production database, VPS, provider, workstation or personal finance data. **A future code-only rollback will not undo historical `Balances` changes already written by the sweep.** A separate, explicit, auditable reconciliation plan is needed for old transaction `refAmount` rows, including manual-rate provenance and a rehearsed independent backup restore. See [FX reconciliation release gates](./2026-11-17-fx-reconciliation-release-gates.md).

### Test acceptance

1. At final SHA: 20/20 app CI including Node unit tests, transaction and currency backend E2E, browser and production image builds.
2. Verify synthetic 1 IDR → USD reciprocal 0.0000625, and AED/IDR cross-rate; older five-decimal truncation must demonstrably fail regression checks.
3. Verify owner/viewer authorization, custom/manual FX precedence, missing-rate fallback, currency migration service and foreign balance history, not only a pure format function.
4. Verify both versioned cache namespaces and the existing goal-missing-rate E2E test.
5. Keep this PR draft and independent of public-security PR #39. Do not promote into PR #10 without review of history rewrite triggers, changed numeric outputs and stored-data compatibility.

Authoritative behavior references:
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toPrecision
- https://www.postgresql.org/docs/16/datatype-numeric.html

**Open issue for maintainer:** Decide whether precision should be defined by significant digits, domain Decimal arithmetic, or a more explicit currency-aware representation. A quick numerical fix is not the same as accounting-grade assurance. Avoid using the ISO 4217 payment minor-unit digits as the FX rate precision cap.
