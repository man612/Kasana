# Inherited MoneyMatter Documentation — Reference Only

> **Lajur. notice:** This documentation package is inherited from MoneyMatter. Its URLs, subscriptions, screenshots, branding, and hosted-service instructions have **not** been fully adapted. It is **not** the official Lajur. documentation website. Use the [Lajur. README](../../README.md) and [self-hosting guide](../../self-hosting/README.md) for the maintained project.

MoneyMatter's original documentation is served at https://docs.moneymatter.app and built with [Astro Starlight](https://starlight.astro.build). That URL belongs to the upstream project; it is **not** an official Lajur. documentation endpoint.

This is a standalone npm project (not a root workspace), so install and run it from this directory:

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # fails on broken internal links or invalid MDX
```

## Writing

- Articles live in `src/content/docs/<section>/*.mdx`; each sidebar group autogenerates from its directory and is ordered by `sidebar.order` in frontmatter.
- Plus-only features: `sidebar: { badge: { text: 'Plus', variant: 'tip' } }` in frontmatter and `<Badge text="Plus" variant="tip" />` inline.

## Screenshots

Articles reference screenshots with `<Screenshot src="/screenshots/..." alt="..." hint="..." />`.
A missing file renders as a placeholder with capture instructions in `npm run dev` and is omitted from production builds.

```bash
npm run screenshots:missing   # checklist of every missing file with what to capture
```

Save each PNG at `public/<src>`, plus an optional dark-theme version as `<name>.dark.png`; the page shows whichever matches the reader's theme. The Docker build compresses screenshots automatically; run `npm run screenshots:optimize` before committing to keep the repo small too.

### Capturing with Playwright

`scripts/capture/` drives the local dev app (ports from the root `.env.development.local`) with a throwaway test user. It needs the root `npm install` for Playwright.

```bash
npm run screenshots:seed   # creates or refreshes docs-test@example.com with demo data, saves the session
```

- `helper.mjs`: `open`, `shot` (30px padding around a locator), `bothThemes`, `innermost`, `clipAround`, `api`.
- `mocks.mjs`: response rewrites for states the test user can't reach (active subscription, trial ended, Enable Banking consent expiring).

The full workflow lives in the `user-docs` Claude skill (`.claude/skills/user-docs/SKILL.md`).

## Deployment

Lajur. does **not** deploy this documentation to MoneyMatter's Docker Hub or hosting infrastructure. The upstream publish job in `.github/workflows/docs.yml` is guarded to run only in `letehaha/moneymatter`; PR builds can still check documentation changes.

For Lajur. documentation, publish only after auditing branding, product claims, licensed assets, and destination infrastructure. The notes below describe **upstream behavior**, not an available Kasana deployment.

`.github/workflows/docs.yml` builds the site on PRs that touch `packages/docs/**`. On `main` it pushes `letehaha/budget-tracker-docs` to Docker Hub and calls the `DOKPLOY_DOCS_DEPLOY_WEBHOOK_URL` secret.
