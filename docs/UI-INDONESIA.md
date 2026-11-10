# Kasana — Indonesia-first UI/UX and Localization Decisions

This document records design and implementation decisions made while adapting MoneyMatter v0.33.14 for an independent Kasana deployment. **Kasana is a working name**, not necessarily the final product name.

## Replaceable product identity

- Application identity lives in `packages/frontend/src/common/brand.ts` (name, tagline, description).
- Brand colors and UI scale live in `packages/frontend/src/styles/global.css`, including `--kasana-brand-*` tokens and `--kasana-ui-scale`; the initial scale is `0.8`.
- HTML/PWA metadata lives in `packages/frontend/index.html`, `packages/frontend/public/site.webmanifest`, and the related favicon/icon files.
- Revisit all these locations if the final product name changes. **Do not remove** original copyright notices, AGPL licensing, or upstream author attribution.
- Income/expense colors communicate financial meaning. They do not automatically need to follow changes in brand colors.

## Shared interface work

- Native and Reka ScrollArea scrollbars use the theme accent.
- Select and Popover content are constrained by the viewport height; category menus offer internal scrolling.
- `FormattedAmountField` handles monetary input in transaction forms. Examples such as `20.000` and `20.000,50` (without the Rp prefix) are formatted while typing, with caret-position handling. The API still receives a numeric value. Parsing and caret behavior have tests.
- Optional transaction fields use an X control and `ResponsiveAlertDialog` when values are present. Collapsing the field does not automatically delete existing stored attachments.
- Settings use their own navigation. The regular sidebar is temporarily condensed without overriding the user's saved sidebar preference. The gear acts as a toggle and shows the active state.
- Dashboard period labels include the full month and year.
- Bahasa Indonesia is the initial UI language, but **upstream translation coverage is incomplete**. An earlier audit found 2,462 Indonesian strings matching the English source; some are legitimate international terms. The full interface still needs a translation review.
- A global `html { zoom: var(--kasana-ui-scale) }` approach targets 80% scale on desktop and mobile. It requires QA on smaller phones, tablets, virtual keyboards, nested popovers, screen readers, and the user's ability to zoom for accessibility. Adjust the scale token if legibility suffers.

### Full-viewport scaling compensation (November 10, 2026)

With `zoom: 0.8` on the root element, Tailwind's `h-dvh` based on `100dvh` covered only 80% of physical viewport height; `w-screen` could likewise cover only 80% of width. In `global.css`, the `h-dvh`, `h-screen`, `w-dvw`, `w-screen`, and their min/max variants were compensated using `calc(100dvh / var(--kasana-ui-scale))` and corresponding expressions.

**Do not remove this compensation** when changing the default UI scale.

An isolated headless Chromium reproduction using 1280×800 desktop and 390×844 phone viewports showed heights of 640 and approximately 675 physical pixels before compensation. With compensation they returned to 800 and 844 pixels; a scale of `1` was also checked. **These are isolated layout checks, not a full-browser QA pass of Kasana routes.**

## Monetary-input scope

Current priorities include transaction amounts, destination transfer amounts, selected account payment fields, split categories, and amounts in foreign currencies. **Do not apply a rupiah formatter** to non-monetary inputs such as interest rates, percentages, dates, coordinates, or ratios.

Financial inputs in other modules (opening balances, credit limits, subscriptions, stock purchases, and loan settlement) have not all been audited. Reuse the shared amount component where suitable, but preserve negative amounts for balance adjustments and higher decimal precision where investments require it.

## Required checks before a VPS rollout

1. Confirm `vue-tsc --noEmit` and `vite build` complete without errors.
2. Exercise amount entry, mid-string edits, deletion, and pasting `1.000.000,50`; verify the API receives the intended numeric amount.
3. Test dropdowns whose triggers are near the top and bottom edges on both desktop and mobile.
4. Check the optional-field X with empty and nonempty values: cancelling confirmation must preserve the field; accepting must only clear the intended UI value.
5. Test the settings gear from the dashboard and nested Settings pages; sidebar sizing should recover when leaving.
6. Verify 80% zoom, card layouts, dialogs, popovers, horizontal scrolling, tooltips, and screen-reader behavior.
7. Verify balances and transactions after frontend updates. A pure UI update should not require replacing the backend or database container.
