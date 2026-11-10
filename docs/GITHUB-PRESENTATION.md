# Kasana — GitHub Presentation and Writing Guidelines

This document defines the **English-first public presentation** of Kasana. The application itself remains **Indonesia-first**, with Bahasa Indonesia as the initial interface language.

## Recommended GitHub About description

> Open-source, self-hosted personal finance with an Indonesia-first experience.

Why this wording works:

- **What it is:** personal finance software.
- **How it runs:** self-hosted, not a promised cloud service.
- **Who it prioritizes:** an Indonesia-first experience without claiming Indonesian bank integration.
- **Independent identity:** the short description markets Kasana only; source attribution remains prominent in the README, legal notices and license files.

Do not put the former product or its original developer in the GitHub About summary: preserve required origin and copyright attribution in the appropriate licensing and acknowledgments sections instead.

It avoids unsupported terms such as *official*, *secure by default*, *fully audited*, *bank-connected*, or *production-ready*.

## Repository metadata

| Field | Recommended value |
| --- | --- |
| Repository name | `Kasana` (working name; can change later) |
| Description | The sentence above |
| Website | Empty until an official Kasana website is live |
| Topics | `personal-finance`, `budgeting`, `expense-tracker`, `self-hosted`, `indonesia`, `rupiah`, `vue`, `typescript`, `agpl-3` |
| Main language for repository copy | English |
| Default product UI locale | Bahasa Indonesia |
| License | AGPL-3.0-only |
| Project maturity | Work in progress; check actual CI and open PRs |

## Writing style

Use clear, international English with a restrained, product-focused tone. Keep headings short, prefer concrete nouns and verbs, and state current capabilities separately from plans.

A consistent documentation structure is:

1. **What Kasana is**, and who it helps.
2. **What works today**, with important limitations.
3. **How to run or contribute**, with commands that actually use Kasana source.
4. **Security, support, and release status**.
5. **Upstream attribution and license**.

Do not copy MoneyMatter's cloud pricing, hosted demo, domain, security guarantees, or upstream community links as if they were Kasana's. Keep accurate source and historical attribution.

## GitHub assets

The main README uses `docs/brand/logo.svg`, the existing Kasana brand asset.

If a social preview is added, GitHub recommends a **1280 × 640** image in PNG, JPEG, or GIF format, **under 1 MB**. Upload through repository **Settings → Social preview**. Use a solid, readable background, the Kasana mark, and one short descriptive line. Avoid stale screenshots and unverified claims.

The connected GitHub tools currently cannot change the About description, topics, homepage, or social-preview image. Those settings must be applied manually in the GitHub web interface.

## Localization boundary

**Do not translate Indonesian app strings into English to match the README.** The product's locale choice is deliberate and separate from English developer documentation.

When documenting Indonesia-specific input examples, use `Rp1.000.000` or `1.000.000,50` where appropriate. Define such examples in English prose and note differences between localized display strings and numeric API values.

## Review checklist for new public copy

- Is the text in English and understandable without project history?
- Does it identify Kasana rather than impersonate upstream MoneyMatter?
- Are product features, integration claims, QA results, and links verified?
- Are code snippets runnable against **Kasana**, not upstream Docker images?
- Are AGPL and original authorship respected?
- Are secrets and private financial data excluded?
- Does the copy still make sense if the product is renamed later?
