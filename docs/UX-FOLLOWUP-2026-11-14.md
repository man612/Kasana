# Lajur. UI/UX follow-up checkpoint — 14 November 2026

This checkpoint records source changes and known limitations for the latest 33-point review. It is **not** a claim that every issue is closed.

## Implementation (frontend)

### Dashboard and invoice
- Centralized empty widget icon proportions via `components/widgets/components/empty-state.vue`.
- Balance Trend's numerical disclosure now has controlled expand/collapse motion, a sticky table header, and an internal scroll gutter.
- Attach Invoice's Indonesian locale strings cover the dialog, matching, AI privacy, errors, and receipt scan outcomes.
- Paid/received toggle uses a sliding active indicator and a keyed hint transition.

### Transaction interaction
- Shared Reka SelectTrigger arrow rotates with open state; reduced-motion supported.
- Disabled Transfer tab gets a delayed tooltip with planned/split-specific reasons.
- Multi-account payment row's temporary account-first hint clears after ~3 seconds and on selection/unmount; persistent form errors remain separate.
- Transaction tag chips and selection marks use transitions; tag-list scrolling has an internal gutter.
- Portaled select and popover content render at the semantic overlay layer `--z-over-dialog` rather than the same layer as the parent dialog. Focus, Escape, and nested modal QA still needed.
- Out-of-wallet help uses an in-app centered explanation dialog rather than an external documentation link.

### Accounts and vehicles
- Create/Edit Account reuse icon-aware option picker and PaymentMethodDialog; method default remains user-editable.
- Edit Account category and default payment method save through the existing account store; no database semantics changed.
- Archive/exclude/delete help is now an in-app explanation dialog; archiving and deletion actions remain unchanged.
- Vehicle classes have distinct icons and contextual descriptions but use the existing persisted class/depreciation curve (not fabricated new rates).
- Vehicle create footer submit is disabled while required inputs are invalid, including year boundaries and custom depreciation.
- Vehicle and common Vuelidate messages localized via shared validation helper with plural/range parameters.
- Settings sidebar includes an explicit Dashboard return link.

### Loan entry and payments
- Loan create and edit dialogs have one header help control near the X; removed redundant create Cancel.
- Two-column input groups align at the top, preventing field shifts when an error message appears.
- Start Date and monthly Payment Day share a responsive row. The day remains an integer 1–31, not a full calendar date.
- Monthly minimum label shortened to Bayar minimum; loan dialog copy simplified.
- Loan payment fields reuse Indonesian numeric formatting; fixed-action footer separates scrolling content from Save/Record.
- Payment form offers **Isi sisa pokok** only for same-currency payments with a known, valid recorded balance and a non-pre-anchor date. It must NOT be mistaken for an exact lender settlement quote (interest accrued, fees, penalties unknown).

## Invariants explicitly preserved

- Account and transaction amount payloads remain numeric, with ISO currency codes in storage.
- Loan balance is a liability and payment source funds decrease accordingly; the UI cannot infer an official settlement amount.
- Loan Simple Mode requires a separate architecture/data migration to express unknown interest or unknown outstanding. No fake 0% rates and no fake 0-balance ledger entries.
- Vehicle depreciation rate curves are unchanged.
- No live personal finance records are created by the UI refactor itself.

## Follow-up decisions and remaining work

1. **Dompet Digital as a true account category — implemented in the follow-up**: direct inspection of the local PostgreSQL database confirmed that `Accounts.accountCategory` is `character varying` / `varchar`, **not** a PostgreSQL ENUM. The app's Sequelize model also specifies `STRING(50)`. No schema migration was required. The follow-up adds `digital-wallet` to shared account categories, API Zod validation, Indonesian/English labels, selector ordering and icon mapping, with regression tests. Payment method `eWallet` remains a separate concept; it is not silently aliased to an account category. Legacy app versions may not recognize the new category, so deploy frontend and backend together.
2. **Vehicle subcategories with new rates**: model new subtypes as descriptive metadata only or explicitly fall back to an existing class; no unverified depreciation coefficients.
3. **Bayar Semua as a legally accurate payoff**: lender quote or all accrued interest/fees required; UI offers a recorded-principal shortcut instead.
4. **Exhaustive authenticated visual/e2e QA** for all flows, scrollbars, dialog stacking, accessibility, currencies and internationalization remains a separate verification gate.
5. **Full global removal of English/IDR display instances** beyond the components touched in this pass remains to be audited.

## Verification gates

- Frontend `vue-tsc`, Vite production build, frontend lint/i18n check and Vitest suites.
- Local Podman image health at http://localhost:8082; verify the specific built asset fingerprint.
- Unauthenticated browser smoke at widths 390, 768 and 1365 px for boot/runtime and overflow.
- Synthetic authenticated tests: create vehicle, create/edit loan, record principal/interest payment, archive account and reopen detail.
- Regression tests for stale account selection and modal layering in planned/multi-account transaction flows.
- No VPS production deployment or irreversible schema changes in this UI-only checkpoint.

## References

- Reka UI portal/dialog/tooltip component documentation: https://reka-ui.com/
- Vue transition documentation: https://vuejs.org/guide/built-ins/transition.html
- OJK consumer financing and repayment information: https://www.ojk.go.id/
- Internal architectural review: `docs/loan-simple-mode-architecture.md`.
