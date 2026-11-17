-- Lajur. fresh-install inventory. Run ONLY on a newly migrated isolated DB.
-- Pure READ ONLY. No emails, account IDs, balances, or secrets are returned.
-- Missing tables must cause ERROR, not a false "empty" result.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';

WITH occupied AS (
  SELECT
    EXISTS (SELECT 1 FROM "Users") AS has_users,
    EXISTS (SELECT 1 FROM ba_user) AS has_auth_users,
    EXISTS (SELECT 1 FROM ba_session) AS has_auth_sessions,
    EXISTS (SELECT 1 FROM "Accounts") AS has_accounts,
    EXISTS (SELECT 1 FROM "Transactions") AS has_transactions,
    EXISTS (SELECT 1 FROM "Balances") AS has_balances,
    EXISTS (SELECT 1 FROM "TransactionAttachments") AS has_attachments,
    EXISTS (SELECT 1 FROM "UsersCurrencies") AS has_user_currency_preferences,
    EXISTS (SELECT 1 FROM "UserExchangeRates") AS has_manual_fx_rates
)
SELECT CASE WHEN
  has_users OR has_auth_users OR has_auth_sessions OR has_accounts OR
  has_transactions OR has_balances OR has_attachments OR
  has_user_currency_preferences OR has_manual_fx_rates
THEN 'NOT_EMPTY_STOP_AND_REVIEW'
ELSE 'EMPTY_APP_DATA_CANDIDATE_ONLY'
END AS fresh_install_result
FROM occupied;

ROLLBACK;
