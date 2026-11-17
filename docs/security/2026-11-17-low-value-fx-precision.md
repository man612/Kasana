# Lajur. finance audit — reciprocal FX precision for IDR and other small currencies

**Status:** Isolated draft candidate; no automatic data rewrite, backfill, migration or deployment. Reviewed source: PR #10 SHA ffc793a6b74d2da9f4887317533c4b03face5c90, 17 November 2026.

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
- Version the global Redis cross-rate cache key as cross_rate:v2 so an old cached value truncated for four hours cannot masquerade as a corrected result. This does not flush Redis or invalidate auth sessions.
- Add pure unit tests for IDR/USD, tiny positive rates, an ordinary pair and invalid/zero handling, plus a real backend E2E test against the IDR→USD and IDR→AED pair endpoint using controlled historical USD-pivot rows.
- Document the new accuracy contract in docs/specifications/foreign-currency-balance-history.md.

### What this does NOT solve automatically

The application stores rates as floating-point values, and transaction amounts/balances are rounded in other services. The underlying data model, minor units and historic stored refAmount/balance rows are not migrated. A change in precision changes newly computed conversions, and any scheduled/nightly revaluation of existing holdings may produce different accurate balance values. An operator needs a data-backed comparison and rollback plan before applying it to an installation with real finances.

This candidate does not create or amend existing transactions, mass reprice a live database, force re-compute balances, change users' base currencies, import historical rates, touch external providers, or run Windows Podman. An explicit separate migration/reconciliation proposal is required if previously truncated historical transactions must be corrected. Any strategy must preserve already-entered/manual amounts and auditability.

### Test acceptance

1. At final SHA: 20/20 app CI including Node unit tests, transaction and currency backend E2E, browser and production image builds.
2. Verify synthetic 1 IDR → USD reciprocal 0.0000625, and AED/IDR cross-rate; older five-decimal truncation must demonstrably fail regression checks.
3. Verify owner/viewer authorization, custom/manual FX precedence, missing-rate fallback, currency migration service and foreign balance history, not only a pure format function.
4. Keep this PR draft and independent of public-security PR #39. Do not promote into PR #10 without review of changed numeric outputs and stored-data compatibility.

Authoritative behavior references:
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toPrecision
- https://www.postgresql.org/docs/16/datatype-numeric.html

**Open issue for maintainer:** Decide whether precision should be defined by significant digits, domain Decimal arithmetic, or a more explicit currency-aware representation. A quick numerical fix is not the same as accounting-grade assurance. Avoid using the ISO 4217 payment minor-unit digits as the FX rate precision cap.
