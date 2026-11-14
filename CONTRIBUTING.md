# Contributing to Lajur.

Lajur. is an independent Indonesia-first adaptation of [MoneyMatter](https://github.com/letehaha/moneymatter), distributed under [AGPL-3.0-only](LICENSE). Contributions to code, documentation, accessibility, localization, and tests are welcome.

## Before submitting changes

1. Check [issues](https://github.com/man612/Kasana/issues) and [pull requests](https://github.com/man612/Kasana/pulls) first.
2. Base new work on the intended development branch. The historical repository default `main` may lag behind active feature work; do **not** mix unrelated cleanup with financial logic changes.
3. Keep changes scoped; add or update tests for behaviors you change. Do not delete unit tests, E2E tests, fixtures, migrations, or operational scripts just because their filenames are old.
4. For money flows, check IDR formatting, negative balances, rounding, multi-account transfers, empty data, errors, accessibility, and narrow viewports.
5. Use synthetic records only. Never commit secrets, `.env`, transaction exports, backups, or actual account information.
6. In the PR, report **which checks actually ran**, which failed or were skipped, remaining risks, and any required migration. Unexecuted checks are not passing checks.

Repository documentation is written in **English**; the product interface defaults to **Bahasa Indonesia**. Keep translations and fallback locales consistent.

## Useful commands

From the repository root after installing dependencies:

```bash
npm ci
npm run lint
npm run typecheck
npm run format:check
```

Relevant test runners reside in `packages/backend` and `packages/frontend`; choose targeted tests before expanding the scope. A build alone does not prove accounting correctness. See the [self-hosting guide](self-hosting/README.md), [branding guide](docs/BRANDING.md), and [repository hygiene policy](docs/REPOSITORY-HYGIENE.md).

## Legal and conduct

Contributions must be compatible with AGPL-3.0-only and preserve upstream notices. **Lajur. has no CLA signing requirement.** The [archived upstream CLA](docs/upstream/CLA.md) is provided solely for provenance; it does not apply to contributions to this repository. See [LICENSING.md](LICENSING.md) for history.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report security concerns privately as described in [SECURITY.md](.github/SECURITY.md); never publish real financial data or credentials.
