/**
 * Public FAQ facts for the independent Kasana project. Keep claims limited to
 * features and deployment arrangements this repository can actually support.
 * Never copy upstream hosted-service prices, support contacts or guarantees.
 */
export const LANDING_FAQ_KNOWLEDGE = `
# Kasana

Kasana is an open-source, self-hosted personal-finance application prioritizing
Indonesian language and rupiah (IDR) defaults. It is independently adapted from
MoneyMatter v0.33.14, distributed under the GNU AGPL-3.0-only license.
Kasana is not the upstream project's official release or commercial cloud service.

Project source and issues: https://github.com/man612/Kasana
Original software and attribution: https://github.com/letehaha/moneymatter
License: https://github.com/man612/Kasana/blob/main/LICENSE

## Features

- Manage manual financial accounts, income and expense transactions,
  transfers, categories, payees and tags.
- Import supported financial files such as CSV and other formats offered in
  the app; the user must verify imported data and account mapping.
- Plan budgets, recurring payments and savings goals.
- View reports, track investment portfolios, vehicles, loans and net worth.
- Use multiple currencies. New Indonesian users can start in IDR, while
  existing accounts keep their configured base currency.
- Optional AI functionality depends on how the user configures models and
  credentials; enabling it can incur third-party provider charges.
- The self-hosted backend contains an MCP server with OAuth permissions
  for reading and, when granted, changing financial records.
  No publicly hosted Kasana MCP endpoint is currently advertised.

## Indonesia-first limitations

- The product does not claim automatic access or synchronization with BCA,
  BRI, Mandiri, Indonesian e-wallets or other local financial institutions.
  Manual entry and supported file imports are the practical starting point.
- The loan calculation model does not automatically reproduce every
  Indonesian provider's flat-interest, deducted-fee or BNPL payment schedule.
- Features in draft pull requests are not part of the stable main branch.
  Check the PR and actual CI results for the current status.
- The application is still being tested. No blanket production-readiness,
  availability, privacy, cybersecurity or backup guarantee is made.

## Hosting, billing and support

- Kasana is intended for independent installation on infrastructure the
  operator controls, typically using Docker Compose.
- No official Kasana paid cloud plan, subscription price, support email,
  hosted demo or proprietary banking connector has been announced.
- A self-hosted installation does not require a subscription to the
  original MoneyMatter hosted service.
- Installation, HTTPS, domain, credentials, database backup and restore
  are the responsibility of the instance operator.
- Refer people to the Kasana repository README and self-hosting guides,
  and send project issues to https://github.com/man612/Kasana/issues.
- Do not send people to moneymatter.app for Kasana login, subscriptions,
  support, or MCP access. That website belongs to the original project.

## Licensing

- Keep the original author and contributor copyright notices and AGPL
  obligations. Independent rebranding must not erase attribution.
- The source made available to network users must correspond to the
  running modified application where required by AGPL.
`.trim();
