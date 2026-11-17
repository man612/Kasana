# Lajur. frontend

Vue 3, TypeScript and Vite interface for **Lajur.** The inherited npm workspace identifier `budget-tracker-fe` remains unchanged to avoid breaking imports, package-lock references, and deployment scripts.

The frontend requires the backend and a database for authentication and real financial operations. Do not treat a standalone static build as a fully functional application.

## Development

Start with the [root README](../../README.md) and [self-hosting guide](../../self-hosting/README.md). Once the backend and environment configuration are available, run from the repository root:

```bash
npm ci
npm -w packages/frontend run dev
npm -w packages/frontend run lint
npm -w packages/frontend run typecheck
npm -w packages/frontend run build
```

The display name is controlled by [`branding.json`](branding.json), while browser and PWA icons are generated from [`assets/app-icon-source.png`](assets/app-icon-source.png). See [branding instructions](../../docs/BRANDING.md). A new visual identity must update all favicon, Apple touch, and manifest assets together.

Use test accounts and synthetic transactions; never publish financial records or secrets. Deploy project-built images to infrastructure under your control, not to upstream MoneyMatter registries.
