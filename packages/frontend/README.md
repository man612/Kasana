# Kasana Frontend

The Vue 3 / TypeScript frontend for Kasana. Its inherited workspace name `budget-tracker-fe` remains unchanged to preserve dependencies and lockfile compatibility.

The frontend alone is **not** a complete application: authentication and financial data depend on the backend and its database.

## Recommended setup

Start with the [root README](../../README.md), [self-hosting instructions](../../self-hosting/README.md), or [local development notes](../../docs/LOCAL-VPS-ID.md). The documented Docker workflow builds both services from **Kasana source**, not from published upstream MoneyMatter images.

For contributors who have configured the backend and required environment variables, run from the repository root:

```bash
npm ci
npm -w packages/frontend run dev
npm -w packages/frontend run lint
npm -w packages/frontend run typecheck
npm -w packages/frontend run build
```

Do not use live financial data for testing. Do not publish Kasana Docker images to the upstream `letehaha` namespace; use the documented local Compose overlays or a registry under your control.
