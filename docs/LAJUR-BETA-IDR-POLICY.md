# IDR-only private-beta backend gate

The Lajur. mobile onboarding currently shows only Indonesian Rupiah (IDR) to new users and disables the currency-add button in the frontend. UI restrictions alone do not restrict authenticated API clients.

To enable the **optional** server-side private-beta restriction, set `LAJUR_IDR_ONLY_BETA=true` (or `1`) in the **backend container** environment and restart only that backend after a normal image/deployment review. The flag defaults to **off** to protect other installations and existing multi-currency workflows. Do not enable this flag automatically for all upstream-compatible deployments.

When enabled:
- First-time `POST /api/v1/user/currencies/base` refuses a non-IDR base before any write.
- `POST /api/v1/user/currencies` refuses new non-IDR currency selections through its shared REST/MCP validation schema.
- `POST /api/v1/user/currencies/change-base` refuses conversion to a non-IDR base before the background job is queued.
- `POST /api/v1/accounts`, MCP `create_account`, and service-backed vehicle/loan account creation refuse a new non-IDR account currency **before** `ensureUserCurrencyConnected` can auto-add it. The service-level guard also covers internal account-creation callers such as imports.
- Existing user currencies, historical balances, accounts, transactions and exchange-rate rows are **not** changed or deleted by the flag. Existing non-IDR accounts remain readable and editable under their existing financial guards.
- Because imports/restores may need to recreate legacy non-IDR accounts, do not enable the flag during a multi-currency restore or migration without a separate import plan.
- Shared-account writes may still connect the currency of an already-shared legacy account so household access is not silently broken. This is intentionally not a blanket prohibition on every non-IDR transaction, portfolio conversion, or original-currency annotation.

The gate is deliberately not a database migration or a blanket prohibition on historical non-IDR records. Existing USD or multi-currency users must be audited before enabling it on a live system. An IDR-only experience for every possible transaction, import, restore, shared resource and administrative path would require a separate domain-wide acceptance audit.

Verification: run the backend unit suite including `idr-beta-policy.unit.ts` and the account-controller E2E case; test currency addition and account creation over REST/MCP with the flag on; verify IDR onboarding and confirm an existing UAH/USD account remains readable. Keep InstaBox's backend flag unchanged until live data, imports/restores and shared-account behavior have been audited.
