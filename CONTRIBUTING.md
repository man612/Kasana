# Contributing to Kasana

Kasana is an independent, Indonesia-first adaptation of [MoneyMatter](https://github.com/letehaha/moneymatter), distributed under [AGPL-3.0-only](LICENSE). Contributions to code, documentation, accessibility, translations, and testing are welcome.

## Before opening a pull request

1. Search [issues](https://github.com/man612/Kasana/issues) and [pull requests](https://github.com/man612/Kasana/pulls) to avoid duplicate work.
2. Discuss larger changes first, especially database migrations, authentication, financial calculations, and deployment.
3. Keep changes focused. Include relevant tests and screenshots for user-facing changes.
4. For monetary UI, verify IDR formatting, negative amounts, rounding, empty states, keyboard navigation, and mobile layouts.
5. Use synthetic data. Never submit production credentials, `.env` files, transaction exports, or private account information.
6. Explain what changed, why, known risks, and **which checks actually ran**. A queued, skipped, or failed test is not a passing test.

Lint results alone do not establish the safety of a database migration, an authentication change, or financial computations.

## Development resources

- [Project overview](README.md)
- [Self-hosting and build instructions](self-hosting/README.md)
- [Windows/VPS setup notes](docs/LOCAL-VPS-ID.md)
- [UI and localization decisions](docs/UI-INDONESIA.md)
- [GitHub Actions](https://github.com/man612/Kasana/actions)

Some upstream package names and Docker Compose identifiers are intentionally unchanged. Do not rename them for branding alone; doing so can break dependencies or disconnect deployments from existing Docker volumes.

## Language and accessibility

**English is the working language for public repository documentation, issues, and pull requests.** The default **application interface remains Bahasa Indonesia**. Keep locale-specific UI translations accurate and preserve the ability to select other supported languages.

Prioritize accessible contrast, keyboard support, readable layouts, and clear financial labels over cosmetic effects.

## License and contribution terms

Contributions must be compatible with AGPL-3.0-only and preserve upstream copyright and attribution notices. **Kasana does not require a separate Contributor License Agreement (CLA).** The inherited `CLA.md` remains for historical reference, not as a contribution requirement.

If contributing separately to MoneyMatter upstream, follow the upstream project's policies.

## Security and conduct

Do not report vulnerabilities or publish secrets in public issues. Follow the [Security Policy](.github/SECURITY.md) and [Code of Conduct](CODE_OF_CONDUCT.md).
