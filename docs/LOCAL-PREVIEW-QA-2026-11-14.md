# Lajur. — local preview checkpoint (14 November 2026)

This is a factual checkpoint for the local development preview, not a production release certification.

## Environment and source

- Windows repo: D:\Projects\lajur-preview-a631edfe
- Branch: feat/lajur-finance-ux-dashboard-accounts-loans-20261114
- Local preview: http://localhost:8082 (loopback only).
- Active preview containers: kasana-podman-frontend-ux20261114 and kasana-podman-backend-ux20261114.
- PostgreSQL, Redis, attachments and currency-rates services retain existing Podman resources.
- Previous preview containers were stopped, not deleted, for rollback.
- The frontend and backend were compiled from this local branch; no VPS or production deploy was attempted.
- Worktree remains uncommitted; staged and unstaged changes coexist. Do not reset, clean or rebase without reviewing them.

## Earlier committed work on this branch's history

- Lajur. visual identity/icon and configurable display branding.
- Purple as the default accent, with user-selectable alternative accent colors.
- Settings/route/tab transitions, dialogs, selection motion, accessible reduced-motion behavior.
- Dashboard quick-action and layout refinements; adjustments to calendar popup sizing and scrollbar styling.
- Transaction create/edit/transfer interaction motion; multi-account split transition and account-first validation.
- Indonesian currency prefixes, transaction payment-method enforcement, Indonesian date/time behavior.
- Tag/category interaction refinements and localized copy; bank/account display adjustments.
- Repository branding/deployment safeguards and prior test coverage.

These are reflected in earlier Git commits. Their end-to-end behavior was not re-tested completely in this checkpoint.

## Current working branch changes (present in deployed preview)

### Dashboard
- Balance Trend comparison clarified; projection and spike information preserved.
- Added expandable numerical balance-by-date view for keyboard/screen-reader access.
- Period labels use current UI locale, including Indonesian dates.
- Dashboard time-range dialog: duplicate title removed, quick-preset short labels in one responsive grid row, controlled scroll and simplified cancel/close controls.
- Customize Dashboard: View Transition layout resize/add/remove with reduced-motion fallback; selection/tap state transitions.
- Notification bell: open-state feedback, icon motion and better constrained panel layout.

### Accounts and vehicles
- Sort selector animated text/indicator and clearer selected state.
- Section name in Indonesian changed from 'Akun manual' to 'Dicatat sendiri'.
- Create Account: more compact layout, logo alignment, currency + balance side-by-side when space allows; removed balance tutorial link.
- Account-category and payment-method pickers use modal/dialog patterns; reused the existing payment picker.
- IDR amount fields use 'Rp' prefix.
- Create Vehicle: sticky footer submit, hidden IDR currency field (data retained), four-digit year validation, Indonesian mileage grouping with km, vehicle-class dialog; depreciation classes preserved.
- Portfolio transfer dialog: sticky footer submit, disabled while invalid or submitting.

### Account details
- Main balance and credit-limit presentation use formatted currency.
- Credit-limit and initial-balance edit fields use shared formatted amount input.
- Balance adjustment: currency input, transition/close-control update while preserving balance calculation and validations.
- Account details and archive language cleaned up where touched; remaining dialog-by-dialog language audit is not declared exhaustive.

### Loans
- Loan name/type use responsive asymmetric two-column layout.
- Personal loan is default; supported pickable categories expanded (business, medical, other); category labels localized and icons use existing presentation helpers.
- Currency input hidden with IDR default, while payload retains currencyCode.
- Relevant monetary fields use formatted amount inputs; loan term renders months and years.
- Simplified 'Bunga tahunan' label and technical explainer behind help affordance; eliminated redundant extra help/Cancel controls.
- Loan Simple mode is NOT implemented. Architecture/risk brief lives in docs/loan-simple-mode-architecture.md; a UI-only toggle would misstate unknown interest/principal and requires an additive data/API strategy.

## Verification completed

- Backend production bundle built with exit 0.
- Frontend production bundle built with exit 0 after raising Node heap to 4 GB.
- Live frontend /sign-in returned HTTP 200 and loaded the newly built index-RXp250XB.js (HTTP 200).
- /api/v1/auth/get-session returned HTTP 200 (endpoint reachability, not an authenticated business operation).
- Browser smoke in local Brave headless: page title Lajur., no startup JS error.
- Login page responsive smoke at widths 390, 768, and 1365 px: no document-level horizontal overflow.
- Backend container reported healthy; DB, Redis and rates containers remained healthy.
- Frontend lint reported 0 errors, 4 existing style warnings; i18n translation keys check passed.
- Vitest in threads mode: 79/79 tests passed across balance adjustment, Create Account, amount formatting, loan duration, and balance comparison.
- Previously run date-selector utilities, account sorting, depreciation, balance trend projections and stats tests passed; one depreciation test was skipped.
- Git diff whitespace checks passed.

## Limitations and next acceptance checks

- Authenticated Dashboard/Accounts/Loan dialog interactions were not yet browser-E2E tested in this checkpoint.
- Verify visual fit/scrollbars/quick presets at 320, 375, 390, 768, 1024 and 1365 px after login, including long Indonesian labels.
- Test actual multi-account transfers, vehicle creation, loan creation and settlement with synthetic data, and confirm no debit or liabilities are double-counted.
- Exercise keyboard focus, closing nested dialogs, reduced-motion, large numbers and invalid values.
- Formatted amount field intentionally limits fractional entry to 2 digits; pasted extra digits are clipped and the displayed amount must match API payload. Consider explicit warning for overprecision rather than silent clipping in a subsequent UX improvement.
- Vite build emitted existing circular-chunk/import warnings; assess runtime routes before declaring production-ready.
- No database migrations were applied for Loan Simple mode; missing interest is still NOT representable safely in the current loan model.
- No commit, Git push, GitHub PR, CI execution, VPS deployment or production release has been completed as part of this local preview session.

## Next operator command (read-only)

From a Windows terminal, use:
podman ps --format "{{.Names}} {{.Status}} {{.Ports}}"

Open http://localhost:8082 and refresh (Ctrl+F5) if an old SPA asset remains cached.
