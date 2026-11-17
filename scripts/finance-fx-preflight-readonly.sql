-- Lajur. FX release-gate inventory, intended for a DISPOSABLE RESTORED database.
-- READ ONLY: PostgreSQL refuses writes inside this transaction. No account IDs,
-- balances, or user identifiers are emitted. Results are aggregate, not a diff.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

-- Source-of-truth storage types (Sequelize model metadata is insufficient).
SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('ExchangeRates', 'UserExchangeRates', 'Transactions', 'Balances')
   AND column_name IN ('rate', 'amount', 'refAmount')
 ORDER BY table_name, column_name;

-- Planner row-count estimates only: no SELECT COUNT(*) over large ledger tables.
-- NULL means no useful ANALYZE/VACUUM estimate exists.
SELECT c.relname AS table_name,
       CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS estimated_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname IN ('Accounts', 'Balances', 'Transactions',
                     'ExchangeRates', 'UserExchangeRates', 'UsersCurrencies')
 ORDER BY c.relname;

-- Matches the nightly sweep's qualifying manual FX accounts. Dedicated
-- loan and vehicle accounts have independent history writers and are excluded.
-- Grouped metadata only: no names, per-account balances, or IDs are output.
SELECT a."currencyCode" AS native_currency,
       bc."currencyCode" AS reference_currency,
       COUNT(*)::bigint AS eligible_manual_accounts,
       COUNT(DISTINCT a."userId")::bigint AS affected_owners
  FROM "Accounts" a
  JOIN "UsersCurrencies" bc
    ON bc."userId" = a."userId" AND bc."isDefaultCurrency" = true
 WHERE a."type" = 'system'
   AND a."accountCategory" NOT IN ('loan', 'vehicle')
   AND a."currencyCode" <> bc."currencyCode"
 GROUP BY a."currencyCode", bc."currencyCode"
 ORDER BY eligible_manual_accounts DESC, native_currency, reference_currency;

-- Manual-rate preferences change how historical values are recomputed.
SELECT COUNT(*)::bigint AS stored_custom_rate_rows
  FROM "UserExchangeRates";

COMMIT;
