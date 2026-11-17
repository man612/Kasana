# Read-only FX impact inventory — disposable environments

This inventory is an **operator-invoked preflight**, not an automated release, backup, or reconciliation. It is safe by SQL transaction mode, output shape, and query timeouts, but a read-only query still incurs some database work. **Use only on a restored disposable PostgreSQL copy**, not on the finance production database.

File: `scripts/finance-fx-preflight-readonly.sql`.

```bash
# Run only when DISPOSABLE_DB_URL points to a verified isolated restore.
psql -X -v ON_ERROR_STOP=1 "$DISPOSABLE_DB_URL" -f scripts/finance-fx-preflight-readonly.sql
```

The script:
- checks the actual PostgreSQL column types and scales for shared and custom FX quotes and stored transaction/balance amounts;
- uses **planner estimates** (`pg_class.reltuples`), not expensive full-table `COUNT(*)`, to characterize volume; these estimates can be stale or null;
- groups foreign-currency **manual-system accounts** eligible for the already-scheduled 18:45 UTC balance history rewrite, excluding dedicated loan and vehicle categories;
- reports the total number of custom FX rate records, without exposing per-user identifiers or financial balances;
- uses a read-only repeatable-read transaction, a 10-second statement limit and a 2-second lock wait limit; it makes no persistent schema/data changes.

**Observed on the disposable E2E PostgreSQL migration (17 November 2026):** log `FX_STORAGE_SCHEMA_DISPOSABLE` from [CI run 44033608543](https://github.com/man612/Kasana/actions/runs/44033608543) confirmed `ExchangeRates.rate` and `UserExchangeRates.rate` are `double precision` (53 binary precision bits) and `Transactions.refAmount` / `Balances.amount` are `bigint` (64 bits). Earlier assumptions that Sequelize's `FLOAT` must create PostgreSQL `REAL` were incorrect for this tested schema. This is not a read of the operator's production database; verify the destination using this script on an isolated restore. Float still does not represent many decimal fractions exactly; a future `NUMERIC` migration requires a measured, separate proposal.

**Explicit limitations:** This inventory cannot calculate the old/new value differences, reconstruct historical manual-rate provenance, prove invariants for transfer/loan/investment ledgers, or substitute for a full encrypted backup restore. Run side-by-side synthetic database comparisons with exact before/after transaction and `Balances` rows before approval. Do not infer historical correctness from a green CI job alone.

Source mapping:
- `packages/backend/src/crons/balance-revalue-sweep.ts`
- `packages/backend/src/services/balances/revalue-balance-history.service.ts`
- `packages/shared/src/types/accounts.ts`

PostgreSQL references:
- https://www.postgresql.org/docs/current/transaction-iso.html
- https://www.postgresql.org/docs/current/datatype-numeric.html
- https://www.postgresql.org/docs/current/monitoring-stats.html
