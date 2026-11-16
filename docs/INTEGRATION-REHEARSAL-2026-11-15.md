# Lajur. integration rehearsal — 15 November 2026

This temporary candidate is `integration/lajur-release-candidate-20261115`, based on feature baseline `82f3812777427a2795bce97130aacac227144292`. It combines reviewed source snapshots for validation only. It does not merge or approve the original draft PRs, replace release authorization, or deploy an installation. `main` and the original feature/PR branches are untouched.

## Source heads and merge history

Every head and base was revalidated against GitHub before integrating. All seven individual application CI runs were successful; that does not certify their combination. Each integration step is a normal two-parent merge, in the requested order.

| PR                                              | Exact source head                          | Local rehearsal merge                      |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| [#24](https://github.com/man612/Kasana/pull/24) | `abcffdb08515f87a34cb4783c4e985dcd789052a` | `919164f389987037da3ebbc849d9ae0df0876c1f` |
| [#26](https://github.com/man612/Kasana/pull/26) | `dea71f270cc1e54004cb35708a89d24920cc2cd2` | `d75855dd617d8c90e7462c988da960789d99a286` |
| [#27](https://github.com/man612/Kasana/pull/27) | `afab87c4f2ec6734ded2c7ed4fee23dcbd9fe4d4` | `d14713b559d2ef49efacb1ee769d634530dca6b5` |
| [#28](https://github.com/man612/Kasana/pull/28) | `2da7051353fa86a739c9c0cdaf689d4d47d7adb6` | `06befd43daa7a2ca8e3882a13bb93fafbe1bf837` |
| [#29](https://github.com/man612/Kasana/pull/29) | `b51f4124d192f73dfdcb01289a8f19e0947952a1` | `35a86b2a3b37c288a2fc8b8c9e1f0383c115778f` |
| [#30](https://github.com/man612/Kasana/pull/30) | `9061af272a7463e473f2be083f6ac4b8427bff26` | `ff8ef0bb074e7065616be89c7c0ea808b8df8a2f` |
| [#31](https://github.com/man612/Kasana/pull/31) | `772c597e2eae589352f8bf9cd2daf67379737bc5` | `d17f3dd3c20a999514eed2870970829c510b4d01` |

Draft [rehearsal PR #32](https://github.com/man612/Kasana/pull/32) and its Actions runs are the canonical final execution record. Recheck their exact head SHA; results on individual source PRs or an older rehearsal commit do not certify a newer tree.

## Conflicts resolved by content

- **#26 workflow:** retained #24's documentation validator and Windows PowerShell job **and** #26's selected-security-floor check and both script regression suites. The backend manifest auto-merged correctly; Lajur. metadata and Zod `~4.6.7` are both asserted.
- **#31 README:** combined the explicit unmerged-feature warning, `main` badge limitation and open-PR link; candidate setup commands name the temporary rehearsal branch.
- **#31 Windows/VPS guide:** retained PowerShell 7.2+, explicit Podman/Docker preflight, provider/readiness checks, separate engine storage and compatibility identifiers. Combined the source-repository slug explanation with an explicit development checkout, not a default-`main` clone.
- **#31 release QA:** retained all seven follow-ups and #10's separation; compared the duplicated QA criteria after whitespace/product-wording normalization before retaining the formatted version. No acceptance criterion was dropped.
- **#31 repository identity:** retained Lajur. branding, licensing, unported-site boundaries and compatibility names; reconciled the current branch map and individual-versus-combined CI claims.
- Motion and historical local-preview notes auto-merged and were reviewed. #31's sourced Indonesian valuation evidence and estimated-value disclaimer are retained, without recalibrating any curve.

No blanket whole-file “ours/theirs” resolution was used. #27–#30 merged without conflicts.

## Per-step checks

| Step | Executed validation                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #24  | Whitespace, public identity, 153 maintained documentation links, Compose boundaries; 32 mocked PowerShell assertions                                                        |
| #26  | Both workflow families and backend metadata/Zod asserted; documentation/security guards; 13 script regressions; 101 focused schema/MCP/loan/account tests; commit-hook lint |
| #27  | Changed-path lint and i18n-key check                                                                                                                                        |
| #28  | Changed-path lint, i18n keys and persisted vehicle-class option test (1 passed)                                                                                             |
| #29  | Changed-path lint and currency/chart formatter tests (90 passed)                                                                                                            |
| #30  | Changed-path lint and amount-entry/currency formatter tests (115 passed)                                                                                                    |
| #31  | Documentation paths, i18n keys, vehicle view lint; executable shared vehicle definitions/coefficients compared with the feature baseline and unchanged; commit-hook lint    |

The rehearsal adds a currency display-to-entry round-trip suite for IDR/USD in Indonesian/English locales, including nonzero fractional rupiah and negative values. This checks #29/#30 composition without changing stored amounts or rounding semantics. The disposable-stack browser suite also covers category selection/clearing with one scroll region, vehicle year/class editing beside the valuation disclaimer, and successful fractional-IDR portfolio cash submission. Seven inherited formatting violations in changed paths were corrected without semantic changes. Combined lint, full unit suites, typechecks, production builds, synthetic HTTP/browser checks and genuine PR CI are recorded on the rehearsal PR after execution; do not infer a passing result from this checklist alone.

## Combined execution checkpoint

The first combined [application run 43712666372](https://github.com/man612/Kasana/actions/runs/43712666372) at `28076921d6ef6de08b476724e5ebf21c62a93375` completed **19/20 jobs successfully**. All four backend E2E shards passed (**4,467 passed / 31 skipped / 7 todo**), backend CI units passed (**3,842 / 15 skipped**) and frontend CI units passed (**4,241 / 34 skipped**). Both production images, frontend build/typecheck, backend typecheck, lint/i18n, knip, Windows PowerShell mocks and synthetic restore passed. Docs, Dependency Review and informational audit workflows passed separately; preview deployment was skipped.

The only failure was the rehearsal's new browser test: its redundant UI sign-in returned HTTP **429** under the unchanged production auth limiter. Reuse the already successful API session for this synthetic user; retain the original smoke's UI-login coverage. Local rendering also corrected the new test's selectors to the actual bilingual controls, excluded the independent split action from the clear-control assertion, and waited for the nested picker to unmount before closing its parent. No product assertion, auth limit or financial expectation was relaxed. The corrected cross-PR browser test passed locally against production bundles and own tmpfs services, including an HTTP **200** portfolio cash request with decimal string **`20000.5`** and displayed fractional IDR balance. The subsequent final-head CI must still pass; see #32 for its observed result.

Local full backend units passed (**3,753 / 104 skipped**, 237 passing suites). The duplicate local full frontend run was interrupted after the exact-head CI unit job passed; do not count that local attempt as a pass. A local bundle attempt hit its 2 GiB heap cap; the same bundle passed with the established CI 4 GiB cap. Local focused HTTP verification passed the original two budget/statistics files (**35 tests**) and the category/loan-payment endpoint regressions (**7 tests**). Those checks used a new `bt-test-lajur-rc-e2e-20261115` namespace and matching locked dependencies with candidate source mounts; no existing installation was reused. The Cloud runtime's packaged Playwright browser was absent, so local screenshots used installed system Chromium through a temporary configuration; GitHub CI installs the matching Playwright Chromium.

The `5ab64f2c` checkpoint recorded a **pre-existing vehicle header issue** at 390×844: owner action buttons overlapped a long vehicle name. That checkpoint preserved the feature baseline layout and deferred the issue. The focused follow-up below corrects the layout on the same draft PR #32. Cloud screenshots do not replace real-device or Windows Podman verification.

## Focused mobile vehicle header follow-up

A rendered regression first confirmed a **936 px² title/action overlap** at 390×844 with a 12.8 px root font: the absolutely positioned 32 px action row intersected the title when the rem-based `@md/vehicle` rule activated. The owner header now uses normal-flow identity/action rows, with side-by-side alignment at `@2xl/vehicle`; fixed top/right reservations are removed. Names, metadata and displayed amounts wrap, and all three owner actions have 44 CSS px minimum targets. The delete icon reuses its existing localized accessible label. Owner/read-only checks and action handlers are preserved.

Doubled-text inspection also exposed an implicit-grid sizing issue: a 339 px content container produced a 732 px auto track, and an ancestor with horizontal clipping masked the overflow. The page now has an explicit `minmax(0, 1fr)` column and inherited text wrapping. This constrains intrinsic width without hiding meaningful text. Regression assertions check the whole hero against viewport bounds as well as its contents against the card.

`vehicle-header.spec.ts` creates synthetic owner/viewer profiles, a long-name vehicle with a valid long unbroken trim, and an actual read-only account share through HTTP. Its matrix is **320, 360, 390, 430 and 1280 px × Indonesian/English × owner/read-only × normal/200% root text size**: 20 cases, 40 layout states. It records screenshots and rectangle geometry; asserts non-overlap, viewport/text containment, horizontal overflow, readable disclaimer and touch target size; opens/closes override, edit and delete with pointer/keyboard interactions; and verifies that cancelled dialogs preserve the stored vehicle settings and balance. The original category-picker, vehicle-class and fractional-IDR browser assertions remain intact.

The original failing frame, tightened doubled-text failure and corrected matrix captures are retained as task artifacts. Local verification passed **22 browser cases with zero retries** (the 20 new matrix cases and both original smoke specs) and **69 focused frontend unit tests across five files**. Frontend lint/i18n and the 4 GiB typecheck passed; existing warnings remain outside the changed files. Final-head GitHub Actions status is recorded in PR #32 after execution; earlier checkpoint CI does not certify this follow-up. No financial formulas, depreciation coefficients, migrations, patched dependency versions or artwork are changed.

## Vehicle amount readability follow-up

At the `81c67d2c` checkpoint, a rendered 390 px / 200% text regression confirmed that `wrap-anywhere` split `Rp 20.000.000,5` inside its final thousands group. Vehicle monetary values now have explicit presentation boundaries at currency/group separators, keeping each digit group and its decimal tail together. The existing formatter output is preserved verbatim, with one complete screen-reader string and an aria-hidden visual representation. Typography, header/actions, currency precision and all valuation calculations remain unchanged. The same presentation applies to current value, purchase/depreciation/projection KPIs and reference/salvage amounts. Adjacent percentages move to another line as a whole token when needed. Large-value inspection also reproduced a split KPI percentage; percentages stay together and the depreciation KPI can move its percentage onto another line.

The amount regression covers IDR/USD with large, negative, zero and fractional display fixtures at 320, 390 and 1280 px with normal/doubled root text (72 states). Separate native Chromium page-zoom cases use its isolated profile's Appearance setting at 200%, checking 320/390 px effective widths for all six amounts (24 states). They verify the doubled DPR, unchanged outer width/root font, CSS zoom of 1 and visual viewport scale of 1; this is browser zoom, not font-size or pinch emulation. Character rectangles check complete visible output, intact digit/decimal groups and clipping/overflow, including the three vehicle KPI cards. Screenshots and zoom metrics are recorded. Negative/zero/large response fixtures are read-only presentation tests; HTTP reads afterwards assert the synthetic vehicle's stored purchase price and balance are unchanged.

Focused formatter/component tests passed **211 tests** (129 new cases, including five locales and standard/narrow currency symbols). The final combined local browser run passed **38 cases with zero retries**, retaining the existing header, permissions/dialog, category-picker, vehicle-class and fractional-Rupiah coverage. See PR #32 for the observed final-head browser and CI results; an earlier checkpoint's green CI does not certify this follow-up.

## Safety and financial boundaries

- Preserve #26's `recordId().optional()` plus the non-transfer category requirement, real HTTP success/ID assertions and original budget-pool/cumulative expectations.
- No stored financial records, schemas, historical migrations, calculation services, loan principal or depreciation coefficients are changed by conflict resolution.
- Preserve the canonical S-curve PNG, AGPL license, archived upstream CLA, display-name synchronization and internal Compose/image/network/volume identifiers.
- Cloud execution uses synthetic data and task-owned test resources only. The stock browser smoke refuses non-GitHub execution; local cloud rendering uses a separately isolated harness rather than spoofing its GitHub guard.
- Root and standalone docs lockfiles match #26. Existing installed dependencies can be reused where their locked versions match; do not regenerate locks or force upgrades for the rehearsal.

## Risk classification and gates

| Issue                                                                                        | Feature integration                                                                                                  | Public deployment / release                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Combined CI and maintainer review                                                            | Require final-SHA green checks and explicit approval; keep rehearsal and source PRs draft                            | Required, but not production certification                                                              |
| Five high npm package findings (Polygon/query-string/decoder and Yahoo Finance/Zod 3 chains) | Explicit security review/risk disposition and tracked follow-ups; do not force incompatible ESM or provider upgrades | Resolve/mitigate applicable reachable risks before exposure; selected floors are not a clean audit      |
| Moderate/low backlog, including docs Astro                                                   | Track exact advisories separately; scopes overlap                                                                    | Assess actual shipped/reachable paths and operator configuration                                        |
| Jest worker teardown warnings                                                                | Assertions and exit codes must be reported accurately; retain focused open-handle follow-up                          | Do not claim clean lifecycle/resource behavior from `--forceExit`                                       |
| Unverified icon permissions                                                                  | Retain provenance uncertainty; do not invent rights or substitute arbitrary artwork                                  | Public artwork distribution remains a release gate pending evidence or a separately approved resolution |
| Real Windows Podman, browser/PWA and physical-device verification                            | Mocked/CI checks cover only their observed scope                                                                     | Required before claiming those deployment/device paths are verified                                     |
| #10 is behind the feature baseline                                                           | Do not update or merge it during this rehearsal                                                                      | Only an approved complete candidate, with fresh checks against `main`, may become a release proposal    |

## Later PR #10 handoff

PR #10 at `30f5f83e6c4e42c0cecdcea71578d54ce616e1c4` is two commits behind the feature baseline and contains none of the seven follow-ups automatically. After maintainer approval, integrate the complete candidate history into the feature branch, then merge that updated feature branch normally into #10's umbrella branch. Verify all seven source heads remain ancestors, inspect its full diff against `main`, and rerun release CI and review. Do not replace the umbrella with an older snapshot, cherry-pick away source history, retarget it, force-push or merge into `main` as part of this task.
