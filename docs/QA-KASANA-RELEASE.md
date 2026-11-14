# Lajur. — Release Gates and QA Checklist

This checklist applies to umbrella integration **PR #10** (combining historical PRs #8 and #9). As of November 14, 2026, PR #10 remains **Draft**, is not merged into `main`, has not been deployed to a VPS, and has not passed full application QA.

Follow-up PRs **#27–#31** target `feat/lajur-finance-ux-dashboard-accounts-loans-20261114`, a branch currently two commits ahead of PR #10's head branch `feat/kasana-indonesia-ui-integrated`. Those follow-ups do **not** automatically appear in PR #10. Review and integrate their changes into the umbrella integration branch before the final merge; do not merge these follow-up PRs directly into `main`.

## 1. Source verification

Run the following commands from the feature checkout with the Node.js version configured by Volta (`24.22.1`) after `npm ci`. For follow-up PRs #27–#31, use `feat/lajur-finance-ux-dashboard-accounts-loans-20261114`; for final umbrella validation, run again after the reviewed follow-up changes have been integrated into `feat/kasana-indonesia-ui-integrated`.

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

**Current CI evidence — November 14, 2026:**
- Umbrella PR #10: [run #43556893156](https://github.com/man612/Kasana/actions/runs/43556893156) and [run #43556893248](https://github.com/man612/Kasana/actions/runs/43556893248) completed successfully.
- Follow-up PR #27: [run #43600252633](https://github.com/man612/Kasana/actions/runs/43600252633) passed.
- Follow-up PR #28: [run #43601239771](https://github.com/man612/Kasana/actions/runs/43601239771) passed.
- Follow-up PR #29: [run #43602739733](https://github.com/man612/Kasana/actions/runs/43602739733) passed, including frontend tests, Docker image builds, synthetic PostgreSQL/attachment restore, and isolated mobile browser smoke.
- Follow-up PR #30: [run #43603034498](https://github.com/man612/Kasana/actions/runs/43603034498) passed the same CI workflow.
- Follow-up PR #31: [run #43604027250](https://github.com/man612/Kasana/actions/runs/43604027250) was still running when this document was updated.

The November 11 run [#42878060359](https://github.com/man612/Kasana/actions/runs/42878060359) is historical evidence only. Passing CI does not prove physical-device UI, real OAuth, actual data recovery, or VPS security.

## 2. Functional browser QA using synthetic data

| Area | Test and acceptance criteria |
| --- | --- |
| Empty onboarding | Sign in as a test user with no accounts. The dashboard should offer **manual account creation** and **file import**, not an irrelevant automatic bank-connection prompt. No excessive blank page height. |
| No transactions | Create an IDR account without transactions. Dashboard grid height should stay compact; an empty Latest Transactions widget must not force two rows even if the saved layout previously used 1×2. |
| Transactions and scheduled bills | Create a subscription due within three days, with no completed transactions. The Latest Transactions widget should still display the **scheduled bill** rather than an empty state. Repeat with 1, 10, and 20+ transactions. |
| Monetary formatting | Enter `1.000.000,50` and verify the API receives numeric `1000000.5`. Enter `-20.000,50` for an opening balance and preserve its negative sign. Test pasting, mid-string deletion, caret position, and blur formatting. |
| Account records | Start with Rp1,000,000 and record an Rp125,000 expense. Expected remaining balance is Rp875,000 with no other transactions. Verify transactions, settings, transfers, and CSV import remain accessible. |
| Bank connections | Header sync controls and irrelevant international bank integration promotions should be absent in the Indonesia-first manual-account flow. Existing bank-linked accounts must remain viewable without losing their transactions or metadata. |
| Quick Start gesture | Single tap opens the panel. Long press for approximately 420 ms, then drag to relocate. The position survives refresh; Reset is disabled at the default position, enabled after moving, and restores the original location. Simulate OS `pointercancel`: the unfinished move must be rolled back and the next tap must work. Use single-tap corner presets without requiring dragging. |
| Hide Quick Start | Test hiding for 1 hour, 24 hours, and 7 days, and reopening through Settings → General. Refresh or reopen the tab before and after expiry. |
| Navigation | Open account and vehicle details from their lists; on deep links, Back should return to a sensible list. The mobile hamburger remains available. Also test loan, portfolio, goals, budgets, trackers, recurring payments, investments, and ventures. |
| Responsive layouts | Test widths of 360 px, 390 px, tablet, and 1280 px desktop with Lajur.'s 80% rem-based density (no root CSS zoom). Rotate the device and open the virtual keyboard. The dashboard must fill the viewport, without horizontal overflow, obscured actions, clipped popovers, or off-screen floating controls. |
| Dialogs and accessibility | Test keyboard Tab/Escape, screen-reader labels, touch targets, back buttons, Indonesian/English language switching, and mobile drawers. Dropdowns/Selects must remain anchored 6 px from their trigger (or flip to the opposite side near a viewport edge); centered modal dialogs are intentionally different. |
| Loans | Verify principal, outstanding balance, interest, term, installments, and projections. **Do not** assume declining-balance amortization models flat interest, deducted origination fees, or provider-specific BNPL schedules. |

- An isolated Playwright/Chromium CI browser test starts Lajur.'s real frontend/backend and synthetic PostgreSQL data, checks an IDR transaction and account detail at mobile viewport with 80% rem-based UI density, verifies full viewport coverage, explicit deep-link Back, accent selection persistence, and anchored Select dropdown geometry. A passing synthetic browser test still does not replace physical Android, native pinch-zoom, or real VPS testing.

### Motion and appearance checks

See [Lajur. Motion System](KASANA-MOTION-SYSTEM.md) for the implementation map, ownership boundaries and motion/performance policy.

- Verify auth/login-to-dashboard shell fade, dashboard route changes, and nested Settings/Analytics/Planned/Payees/Data Management content transitions. Parent navigators should remain mounted when child tabs change.
- Verify active Reka tab content animates in without delaying focus or changing form inputs; validate the underline/pill indicator independently.
- Create, rename, filter and delete tags/trackers. Lists of up to 40 keyed items use Vue TransitionGroup FLIP; larger groups must stay responsive without 40+ simultaneous layout animations. Never animate the virtualized transaction list.
- Change onboarding task completion: its check/circle and category status icons should cross-fade and scale briefly. Verify dragging Quick Start does not acquire unwanted transform transitions.
- Trigger and clear a form validation message. Error text should enter/exit briefly without losing the screen reader announcement or keyboard focus.
- In Settings → Appearance, purple must be selected by default. Green/blue choices immediately update brand buttons and focus rings, persist after refresh, and do not change the independent light/dark theme.
- Open/close the sidebar settings popover: its gear rotates into the open state and returns when closed. Test keyboard activation as well as touch.
- Verify existing Reka select/popover/dialog and Vaul drawer animations, including scrollable dialog content, hover/focus/pressed states and sliding panels. The motion system extends built-in Vue transitions without a new heavy runtime or blanket `transition: all`.
- Turn on OS **Reduce motion**. Decorative movement and sliding should stop, while focus visibility, accessibility and navigation remain functional.
- Browser zoom levels 80%, 100% and 125% should be checked separately from the app's built-in 80% density. Browser-level zoom on a physical device is not reproduced by injecting `html.style.zoom` into a test.

## 3. Infrastructure and data protection

- Backend integration tests now exercise real API requests against synthetic IDR accounts with fractional expense/income amounts and negative opening balances. Passing those tests does not automatically confirm displayed currency strings or touchscreen input behavior.

- Verify [the public-repository security readiness record](PUBLIC-REPOSITORY-READINESS-ID.md). GitHub Secret Scanning, Push Protection, Dependabot alerts/updates, and private vulnerability reporting were enabled November 11, 2026; check subsequent alerts and old history separately.
- Check the public-identity guard with `node scripts/check-public-identity.mjs`, including locale strings and outbound URLs, to prevent reintroducing inherited hosted services or original-developer support details.

- Back up **both** the database and attachment volumes, along with securely stored application secrets. Perform a **restore test** in an isolated environment.
- CI runs a **synthetic** two-database backup/restore + attachment-byte comparison using disposable PostgreSQL containers. A green synthetic test is not proof that a real VPS backup is complete, encrypted, restorable, or compatible with its application version.
- On Windows, run `./scripts/run-local-private.ps1` followed by `./scripts/verify-local-private.ps1` in PowerShell, then inspect all container health statuses.
- For VPS deployment, follow [Windows/VPS setup notes](LOCAL-VPS-ID.md) and verify `docker compose ... config --quiet` before `up -d --build`. Require HTTPS, correct origin/cookie settings, proxy headers or Cloudflare Tunnel configuration, and non-public database access.
- Never run `docker compose down -v` on systems containing real data. Do not force-convert existing users' base currency.
- Preserve AGPL-3.0 attribution and any source-availability obligations that apply to the deployment.

## 4. Merge gate

PR #10 may only be considered ready when relevant lint, typecheck, unit tests, builds, and regression checks are **passing**, real-device browser QA is complete, review conflicts are resolved, and backup/restore plus rollback procedures are verified.

Merge **only the umbrella PR #10** to `main` for this combined feature work. Follow-up PRs #27–#31 are branch-level review units, not independent mainline releases; integrate approved changes into the PR #10 head branch and rerun final CI/QA before merging. PRs #8 and #9 were closed as superseded and must not be merged separately.
