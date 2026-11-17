# Lajur. integration reconnaissance — 14 November 2026

This is a read-only snapshot of open PRs, their fetched heads and GitHub Actions. It is not merge/deployment authorization. Recheck heads, CI and conflicts after every integration step.

## Verified source map

The task started from a clean `work` checkout at `38dd67b8d` (the current `main`), then switched to `chore/lajur-repository-hygiene-20261114` at PR #24 head `3314f5a`. No edits were made to `main`. The feature baseline is `82f3812777427a2795bce97130aacac227144292` on `feat/lajur-finance-ux-dashboard-accounts-loans-20261114`.

| PR                                              | Head inspected               | Base             | Latest inspected application CI                                                                              |
| ----------------------------------------------- | ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| [#10](https://github.com/man612/Kasana/pull/10) | `30f5f83e6`                  | `main`           | [43556893248](https://github.com/man612/Kasana/actions/runs/43556893248): success                            |
| [#24](https://github.com/man612/Kasana/pull/24) | `3314f5a24` before this task | feature baseline | [43593287628](https://github.com/man612/Kasana/actions/runs/43593287628): success for that earlier head only |
| [#26](https://github.com/man612/Kasana/pull/26) | `96b2e3c8c`                  | feature baseline | [43597553198](https://github.com/man612/Kasana/actions/runs/43597553198): failure                            |
| [#27](https://github.com/man612/Kasana/pull/27) | `afab87c4f`                  | feature baseline | [43600252633](https://github.com/man612/Kasana/actions/runs/43600252633): success                            |
| [#28](https://github.com/man612/Kasana/pull/28) | `2da705135`                  | feature baseline | [43601239771](https://github.com/man612/Kasana/actions/runs/43601239771): success                            |
| [#29](https://github.com/man612/Kasana/pull/29) | `b51f4124d`                  | feature baseline | [43602739733](https://github.com/man612/Kasana/actions/runs/43602739733): success                            |
| [#30](https://github.com/man612/Kasana/pull/30) | `9061af272`                  | feature baseline | [43603034498](https://github.com/man612/Kasana/actions/runs/43603034498): success                            |
| [#31](https://github.com/man612/Kasana/pull/31) | `772c597e2`                  | feature baseline | [43604651018](https://github.com/man612/Kasana/actions/runs/43604651018): success                            |

All eight PRs were open drafts. PR #10 is an ancestor of the feature baseline, **two commits behind** (`git rev-list --left-right --count origin/pr-10...origin/feat/lajur-finance-ux-dashboard-accounts-loans-20261114` returned `0 2`). Merging #10 as inspected would omit the newer feature baseline and all follow-ups. No existing PR was retargeted, merged or modified by this reconnaissance.

## Dependencies, overlap and suggested order

1. Review and integrate **#24** into its feature base after the new hygiene checks and CI pass.
2. Complete **#26**'s focused Zod/HTTP regression work below, then integrate the security changes and rerun the complete application suite against the combined feature head. Remaining advisories still require independent triage.
3. Integrate **#27**, **#28**, **#29**, then **#30**. These have no changed-file intersections with each other at the inspected heads; the order is organizational, not a proven code dependency. Review grouped vehicle pickers together with #31, and test #29's currency display with #30's amount fields.
4. Integrate **#31** after reconciling its documentation with #24. Keep its sourced vehicle research and estimate disclaimer; keep #24's current identity, branch, Podman/provider and storage instructions.
5. Only after explicit approval, update the **#10 integration branch** to include the complete feature baseline and approved follow-ups, rerun all release gates, and review that combined PR against `main`. This task does not authorize merging it.

At the original #24 head, #26 overlaps only `packages/backend/package.json`; Git's three-way merge combines its Zod version change and #24's description change cleanly. #27–#30 have no file overlaps with #24. #31 overlaps #24 in `README.md` and `docs/LOCAL-VPS-ID.md`, and `git merge-tree --write-tree` reports content conflicts in both even before this task. The new hygiene edits also overlap #31 in `docs/QA-KASANA-RELEASE.md`, `docs/LOCAL-PREVIEW-QA-2026-11-14.md`, `docs/KASANA-MOTION-SYSTEM.md`, and `docs/REPOSITORY-RENAME-ID.md`. Resolve semantically; do not choose one complete side and discard the other. Recalculate conflicts on the final combined branch.

Individual green CI runs do not validate their eventual combination. The PR bodies still list workstation visual checks as pending, including mobile split dialogs, create/edit vehicle forms, IDR/USD entry/Max/reset, and the estimate disclaimer in English/Indonesian. Actual Podman source builds, post-login browser/PWA inspection, backups and deployed-revision verification remain separate gates.

## PR #26: two failures and a focused reproduction

[Shard 2 job 132455340504](https://github.com/man612/Kasana/actions/runs/43597553198/job/132455340504) reported **2 failed suites, 79 passed; 2 failed tests, 1,086 passed, 4 skipped, 3 todo**:

- `src/services/budget-plans/pool.e2e.ts:350`: “counts an uncategorised loan payment as spending outside lines”, expected `-300`, received `0`.
- `src/services/stats/get-cumulative-data.e2e.ts:263`: “excludedCategoryIds: an excluded parent drops its child while uncategorized spend stays”, expected `150`, received `100` (the missing loan-payment expense is `50`).

Both fixtures POST a loan-payment transaction with `categoryId: undefined`. JSON serialization omits that property. `controllers/transactions.controller/schemas.ts` declares `categoryId: z.union([recordId(), z.undefined()])`. `tests/helpers/common.ts` extracts `body.response` for `raw: true` without asserting HTTP success, so these fixtures can continue after a rejected POST and fail only at the totals assertion.

A safe standalone probe was executed in Codex Cloud using the installed Zod **4.3.6** and an isolated `/tmp` install of **4.6.7**, without changing the repository lockfile or dependencies. For the reduced equivalent schema `z.object({ categoryId: z.union([z.string(), z.undefined()]) })`:

| Input                                        | 4.3.6   | 4.6.7                                              |
| -------------------------------------------- | ------- | -------------------------------------------------- |
| `{}` (actual serialized request shape)       | accepts | rejects: `expected nonoptional`, path `categoryId` |
| `{ categoryId: undefined }` (in-memory only) | accepts | accepts                                            |
| `{ categoryId: 'synthetic-category' }`       | accepts | accepts                                            |

This reproduces a concrete schema compatibility change and strongly explains both failures; the full HTTP failure has **not** been reproduced in this task. PR #26 already makes two other `z.undefined()` branches explicitly optional in category/holding schemas. Its dependency update does not change the transaction schema above.

Next task on **#26**, with isolated synthetic services: assert successful creation and the returned transaction/transfer legs in both failing fixtures; inspect the actual HTTP validation response; add a regression for an **absent** category field through the endpoint; make intended optionality explicit while preserving transaction semantics. Review other absent-versus-undefined schemas for the same Zod behavior. Do not lower expected totals or bypass assertions.

Run the two E2E files together through the existing Docker harness, sequentially, from the #26 checkout:

```bash
npm -w packages/backend run test:e2e -- --testPathPattern='(budget-plans/pool|stats/get-cumulative-data)\.e2e'
```

Then rerun full #26 CI. This command was **not executed** here; the standalone schema probe and CI logs are the evidence above. The Docker test harness remains separate from the PowerShell Podman source-build workflow.
