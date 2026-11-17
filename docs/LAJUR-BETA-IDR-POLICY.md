# IDR-only private-beta backend gate

The Lajur. mobile onboarding currently shows only Indonesian Rupiah (IDR) to new users and disables the currency-add button in the frontend. UI restrictions alone do not restrict authenticated API clients.

To enable the **optional** server-side private-beta restriction, set `LAJUR_IDR_ONLY_BETA=true` (or `1`) in the **backend container** environment and restart only that backend after a normal image/deployment review. The flag defaults to **off** to protect other installations and existing multi-currency workflows. Do not enable this flag automatically for all upstream-compatible deployments.

When enabled:
- First-time `POST /api/v1/user/currencies/base` refuses a non-IDR base before any write.
- `POST /api/v1/user/currencies` refuses new non-IDR currency selections through its shared REST/MCP validation schema.
- `POST /api/v1/user/currencies/change-base` refuses conversion to a non-IDR base before the background job is queued.
- Existing user currencies, historical balances, accounts, transactions and exchange-rate rows are **not** changed or deleted by the flag. Read, edit and delete operations remain available for legacy data, subject to their existing financial guards.

The gate is deliberately not a database migration or a blanket prohibition on historical non-IDR records. Existing USD or multi-currency users must be audited before enabling it on a live system. An IDR-only experience for every possible transaction, import, restore, shared resource and administrative path would require a separate domain-wide acceptance audit.

Verification: run the backend unit suite including `idr-beta-policy.unit.ts`, test unauthorized currency additions over REST and MCP with the flag on, verify an IDR onboarding success, and verify that an existing multi-currency user can still view their financial history. Keep InstaBox's backend flag unchanged until that live-data audit is complete.
