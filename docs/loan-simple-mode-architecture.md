# Decision brief: simple loan entry without invented financial data

Status: **research and architecture proposal, not implemented**. The existing loan model and migration remain unchanged by this UI pass.

## Evidence inspected in this repository

- `packages/shared/src/types/loans.ts`: each loan has an Account balance and a LoanDetails sidecar; current principal and interest details are typed as mandatory.
- `packages/backend/src/services/loans/zod-schemas.ts`: creation requires `initialBalance >= 0`, `originalPrincipal > 0`, `interestRate >= 0`, and `startDate`. `termMonths`, `plannedPayment`, `minPayment`, and `paymentDayOfMonth` may be missing/null.
- `packages/backend/src/services/loans/create-loan.service.ts`: creation writes **negative** Account balance so the liability participates in net-worth calculation. Original principal and rate are stored in LoanDetails.
- `packages/backend/src/services/loans/project-loan.ts`: positive outstanding is computed from negative current balance and fed to `computeLoanProjection` together with original principal, interest rate, term and planned payment.
- `packages/frontend/src/pages/loans/components/loan-form.vue`: annual nominal rate divided by 12 for an annuity estimate, and existing rates are mandatory in the form. Existing payment flows and projections assume a particular interpretation of loan repayments.

## Financial facts that determine UX

1. **Unknown is not zero**. An unknown interest rate must not be stored as 0%; 0% is a positive claim about the contract.
2. **Original principal is not outstanding balance**. For an already-running loan, a known original drawdown does not reveal the remaining debt. Equating them inflates liabilities.
3. **Outstanding principal is not the sum of remaining installments**. Future installments may contain interest and fees.
4. **Cash received is not the liability**. A cash disbursement affects the bank account; the debt affects liabilities. Automatically creating both without an explicit user flow risks double-counting.
5. **Flat, reducing-balance sliding, and annuity rates are distinct**. The label "APR" must not claim inclusion of fees when the computation only divides a nominal annual rate by 12.
6. **Installment amount does not disclose the principal portion**. Current transfer-to-loan booking treats loan-side receipts as principal reduction; splitting interest/fees accurately needs explicit evidence or a supported contract model.

Reference: Indonesian Financial Services Authority (OJK), Financial Literacy Series, Book 2: Banking (2019), page 46 (flat/sliding/annuity): https://sikapiuangmu.ojk.go.id/FrontEnd/LiterasiPerguruanTinggi/assets/pdf/Buku%202%20-%20Perbankan.pdf . Also Book 5: Financing Institutions, page 68: https://sikapiuangmu.ojk.go.id/FrontEnd/LiterasiPerguruanTinggi/assets/pdf/Buku%205%20-%20Lembaga%20Pembiayaan.pdf .

## Recommended dual-mode flow

**Simple (Catat utang)** is default for new casual users; **Detailed (Rincian lengkap)** is a visible second mode. Both modify **one form state**, not two records, and never discard existing values on switching.

Simple sequence:
1. Loan name and kind (default personal). Optional lender, optional reference.
2. Ask "Berapa sisa utang sekarang?" Provide known exact, approximate, or "Belum tahu" answers. Approximate values must be labeled estimates and have an as-of date.
3. If known, capture the owed amount. If unknown, create a *non-financial draft* separate from the Accounts liabilities, **not a fake 0-balance loan**.
4. Optional "Berapa cicilan per bulan?" "Tanggal jatuh tempo tiap bulan?" and optional original borrowed amount. Never infer rate/term from these alone.
5. Review before save: which figures are facts, estimates, unknown and therefore excluded from projections.

Detailed form includes origination date, original principal, rate **and rate method**, fees, term, minimum/planned payments. Only offer annuity payoff simulations when a compatible method, positive outstanding, known rate, remaining term and payment details exist.

Use labels:
- "Bunga belum diketahui" rather than "0%".
- "Perkiraan, belum termasuk bunga atau biaya" on incomplete estimates.
- "Sisa pokok" versus "Total tagihan mendatang" in separate sections.

## Data model and compatibility proposal

A **UI-only simple-mode toggle is not enough** for missing rate/principal. Safest evolution is additive:
- `LoanDetails.originalPrincipal` -> nullable; `LoanDetails.interestRate` -> nullable, with explicit semantics null = unknown. Keep 0 = confirmed interest-free. Consider `startDate` nullable when unknown (not silently today's date).
- Add optional `interestMethod` enum: `annuity_nominal`, `declining_equal_principal`, `flat`, `unknown`; existing loans migrate to `annuity_nominal` if the current model truly intended that, or mark legacy calculation method with a guarded warning.
- Add `balanceConfidence` (`verified`, `estimated`) and `balanceAsOf` to distinguish estimate from a confirmed snapshot.
- **Do not allow Accounts.currentBalance to be null as a quick fix**. The account ledger and net worth currently require numeric money. Unknown-balance drafts should live in an isolated lightweight `loan_drafts` model (or be unlisted until a balance is confirmed) and not enter the ledger.
- Use explicit `projectionStatus` and `projectionUnavailableReason`; never display a fictional payoff date or "estimated 0% rate".
- Preserve all old API fields, wire compatibility serializer defaults carefully, and introduce schema/migration/backfill plus tests before removing any non-null constraint. Keep old clients working.

## System impact by area

| Area | Impact |
|---|---|
| New loan form | Progressive disclosure, one shared state, optionality and honest labels |
| LoanDetails database and validation | **Migration required** to represent unknown principal/rate/start date |
| Accounts balance | Unchanged for known outstanding; unknown drafts cannot participate |
| Transfer and loan payment | Must separate principal from interest/fees before claiming exact reconciliation |
| Dashboard and net-worth | Sum only confirmed or clearly marked estimated balances; show missing-data warnings |
| Loan projection | Guard missing/unknown rates and unsupported calculation methods; no fictitious dates |
| Reports/exports | Distinguish actual, estimated and unquantified liabilities |
| Existing accounts and loans | Keep numerical values and legacy semantics intact; no destructive rewrite |

## Verification gates before implementing Simple mode

- Create debt with known outstanding and unknown interest without a phantom 0% assumption.
- Create a name-only draft; dashboard/net-worth totals **do not change**.
- Upgrade a draft to confirmed balance and verify exactly one liability account is created.
- Switch Simple -> Detailed -> Simple and retain user-entered values.
- Compare interest-free, flat, declining, annuity and fee-based loans to signed contract amounts.
- Verify repayments with explicitly split principal vs interest and a partial-payment scenario.
- Upgrade a legacy loan record without changing its computed balance or event history.
- Verify duplicate submissions, concurrent updates, account archival, timezone boundaries, CSV export and deletion.
- Cover accessibility, keyboard/focus, reduced motion and currency formatting.

**Decision for the present UI change:** implement the reversible, presentational loan form improvements only. Defer a real simple entry mode, migrations and any guessed interest or outstanding balances until the above contracts and tests are designed and verified.
