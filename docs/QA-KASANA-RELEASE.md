# Kasana — Release Gates and QA Checklist

This checklist applies to integration **PR #10** (combining historical PRs #8 and #9). The UI changes remain **Draft**, are not merged into `main`, have not been deployed to a VPS, and have not passed full application QA.

## 1. Source verification

Run the following commands from a checkout of `feat/kasana-indonesia-ui-integrated` with the Node.js version configured by Volta (`24.22.1`) after `npm ci`:

```bash
npm run lint -w packages/frontend
npm run typecheck -w packages/frontend
npm run test:unit -w packages/frontend -- --run
npm run build -w packages/frontend
npm run knip -w packages/frontend
npm run typecheck -w packages/backend
npm run test:unit -w packages/backend -- --runInBand
```

Backend unit tests require the correct test environment and may need `NODE_OPTIONS=--max-old-space-size=4096`. Run backend e2e tests in the project's Docker test environment, **never** against real credentials or production financial data. If a required step fails, **do not merge or deploy**.

**Updated CI finding, November 11, 2026:** GitHub Actions initially failed before assigning a runner, but later began running actual checks after the repository became Public. The current work is to fix **real lint and test failures**; earlier step-less failures are not evidence about code correctness. Check [Issue #11](https://github.com/man612/Kasana/issues/11) and the current PR run rather than relying on historic results.

## 2. Functional browser QA using synthetic data

| Area | Test and acceptance criteria |
| --- | --- |
| Empty onboarding | Sign in as a test user with no accounts. The dashboard should offer **manual account creation** and **file import**, not an irrelevant automatic bank-connection prompt. No excessive blank page height. |
| No transactions | Create an IDR account without transactions. Dashboard grid height should stay compact; an empty Latest Transactions widget must not force two rows even if the saved layout previously used 1×2. |
| Transactions and scheduled bills | Create a subscription due within three days, with no completed transactions. The Latest Transactions widget should still display the **scheduled bill** rather than an empty state. Repeat with 1, 10, and 20+ transactions. |
| Monetary formatting | Enter `1.000.000,50` and verify the API receives numeric `1000000.5`. Enter `-20.000,50` for an opening balance and preserve its negative sign. Test pasting, mid-string deletion, caret position, and blur formatting. |
| Account records | Start with Rp1,000,000 and record an Rp125,000 expense. Expected remaining balance is Rp875,000 with no other transactions. Verify transactions, settings, transfers, and CSV import remain accessible. |
| Bank connections | Header sync controls and irrelevant international bank integration promotions should be absent in the Indonesia-first manual-account flow. Existing bank-linked accounts must remain viewable without losing their transactions or metadata. |
| Quick Start gesture | Single tap opens the panel. Long press for approximately 420 ms, then drag to relocate. The position survives refresh; Reset is disabled at the default position, enabled after moving, and restores the original location. |
| Hide Quick Start | Test hiding for 1 hour, 24 hours, and 7 days, and reopening through Settings → General. Refresh or reopen the tab before and after expiry. |
| Navigation | Open account and vehicle details from their lists; on deep links, Back should return to a sensible list. The mobile hamburger remains available. Also test loan, portfolio, goals, budgets, trackers, recurring payments, investments, and ventures. |
| Responsive layouts | Test widths of 360 px, 390 px, tablet, and 1280 px desktop with Kasana's 80% scale. Rotate the device and open the virtual keyboard. Check for horizontal overflow, obscured actions, clipped popovers, and off-screen floating controls. |
| Dialogs and accessibility | Test keyboard Tab/Escape, screen-reader labels, touch targets, back buttons, Indonesian/English language switching, and mobile drawers. |
| Loans | Verify principal, outstanding balance, interest, term, installments, and projections. **Do not** assume declining-balance amortization models flat interest, deducted origination fees, or provider-specific BNPL schedules. |

## 3. Infrastructure and data protection

- Back up **both** the database and attachment volumes, along with securely stored application secrets. Perform a **restore test** in an isolated environment.
- On Windows, run `./scripts/run-local-private.ps1` followed by `./scripts/verify-local-private.ps1` in PowerShell, then inspect all container health statuses.
- For VPS deployment, follow [Windows/VPS setup notes](LOCAL-VPS-ID.md) and verify `docker compose ... config --quiet` before `up -d --build`. Require HTTPS, correct origin/cookie settings, proxy headers or Cloudflare Tunnel configuration, and non-public database access.
- Never run `docker compose down -v` on systems containing real data. Do not force-convert existing users' base currency.
- Preserve AGPL-3.0 attribution and any source-availability obligations that apply to the deployment.

## 4. Merge gate

PR #10 may only be considered ready when relevant lint, typecheck, unit tests, builds, and regression checks are **passing**, real-device browser QA is complete, review conflicts are resolved, and backup/restore plus rollback procedures are verified.

Merge **only PR #10** for this combined feature work. PRs #8 and #9 were closed as superseded and must not be merged separately.
