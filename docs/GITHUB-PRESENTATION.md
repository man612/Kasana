# Lajur. — GitHub presentation guide

Public repository documentation uses **English**; the application defaults to **Bahasa Indonesia**. The display name includes the final period: **Lajur.** The `man612/Kasana` GitHub path is deliberately retained for link continuity.

## Accurate product description

> Open-source, self-hosted personal finance with an Indonesia-first experience.

This identifies what the software does and how it runs without promising cloud hosting, automatic connections to Indonesian banks, a security audit, or production readiness. Lajur. is an independent adaptation of MoneyMatter; original attribution remains prominent in [README](../README.md) and [LICENSING](../LICENSING.md).

Recommended repository topics: `personal-finance`, `budgeting`, `expense-tracker`, `self-hosted`, `indonesia`, `rupiah`, `vue`, `typescript`, `agpl-3`.

## Brand assets

The root README displays `packages/frontend/public/web-app-manifest-192x192.png`. The actual source of the current logo is `packages/frontend/assets/app-icon-source.png`, not the retired upstream generator. Recreate browser/Apple/PWA sizes together via [BRANDING.md](BRANDING.md). The default accent is purple, but users can choose other themes.

Do not use old M-shaped MoneyMatter or K-shaped Kasana icons for current Lajur. surfaces. Historical source attribution does not require preserving an unrelated visual identity as the current logo.

If adding a social preview, review rendered crops in both light and dark contexts. GitHub's repository social preview is managed in repository settings; **a committed image alone does not prove a GitHub social preview was configured**.

## Publication boundaries

- The root README and `self-hosting/` describe the maintained open-source app.
- `packages/landing/` and `packages/docs/` contain **inherited upstream material**. They are not live Lajur. marketing or docs websites and may still contain claims about another product, cloud pricing, screenshots, or an upstream domain. Do not deploy or present them as Lajur. without a separate content and licensing audit.
- Do not imply that the latest feature branch has shipped to `main`. Validate the exact revision and deployment first.
- Preserve `LICENSE`, original copyright statements, and [archived historical CLA](upstream/CLA.md). A name change does not confer new copyright rights.
- Keep internal database, volume, and package identifiers unless a migration plan explicitly addresses them.

## Writing and review

Prefer short, verifiable feature descriptions. Clearly separate current capabilities from planned features, test evidence from assumptions, and self-hosted software from services offered by external operators. Do not use genuine financial data in screenshots, fixtures, or public issues.

Review branding, public URLs, commands, accessibility, localization, security reporting, licensing, and test evidence before merging or publishing. See [REPOSITORY-HYGIENE.md](REPOSITORY-HYGIENE.md).
