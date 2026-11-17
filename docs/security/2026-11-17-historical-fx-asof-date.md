# As-of historical FX selection — isolated review (17 November 2026)

**Status:** Draft; no migration, deployment, backfill or modification to operator data. This fix is stacked on the [FX integration rehearsal PR #44](https://github.com/man612/Kasana/pull/44).

## Source-level defect

`resolveUsdRates.loadRate` previously read an exact-date quote, then if missing fetched the row with the maximum date for that currency, **without restricting it to the requested date**. For a historical conversion requested on 2020-03-15 with synthetic USD→XOF quotes 500 on March 10 and 1000 on March 20, it would pick March 20 (1/1000 XOF→USD) rather than March 10 (1/500), a 50% misvaluation. This is a constructed regression fixture, not a real currency quote.

The account-history bulk resolver already prefers last-known on/before each day. A dated transaction lookup choosing a later price could therefore disagree with that history, even without the unrelated low-value reciprocal FX truncation.

## Fix / fallback policy

1. Exact dated quote first.
2. Nearest earlier published quote if exact-day is missing (weekends/holidays).
3. **Only if no earlier history exists**, choose the earliest known later quote, preserving the existing application bootstrap convention. Such valuations are approximations, not a genuine rate on the transaction day.
4. Keep `RateLookup.kind = 'fallback'` and `rateDate` so consumers know which publication was used. Fallback conversions remain uncached by the global four-hour exact-date cross-rate cache.

Explicit missing historical coverage policy differs across vendors. [An ECB/Fed-derived historical converter](https://currencies.grandtrunk.net/) uses last previous business day, [an API reference](https://exchangerate.dev/docs/endpoints/historical) labels weekend forward filling, while [IMF accounting principles](https://www.elibrary.imf.org/display/book/9781589068124/ch03.xml) distinguish transaction-date rates from balance-sheet-date valuation. The earliest-future bootstrap is an existing Lajur compatibility concession, **not** a bank/IMF accounting standard. The release review should decide whether to warn or reject transactions earlier than all published history.

## Verification and risk

- Unit mock verifies priority: exact → earlier → earliest future and only the needed number of DB queries.
- Real disposable PostgreSQL E2E inserts synthetic quotes both before and after the date; demonstrates correct as-of rate/date, plus earliest-future bootstrap.
- No update of existing `Transactions.refAmount`; historical values previously computed using a future quote are NOT automatically corrected.
- New conversions and revalued `Balances` may differ after deployment. Keep this PR draft and include in [old/new ledger reconciliation issue #45](https://github.com/man612/Kasana/issues/45).
- Additional single indexed `date ASC` query only when there is neither an exact quote nor an earlier quote. Review database query plans and bulk-import performance for real-world scale.

Sequelize v6 supports `Op.lt` comparisons and indexed `order` clauses: https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
