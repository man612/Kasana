# Kasana UX Review — Account and Vehicle Creation for Indonesia

**Initial review:** November 10, 2026. **Research update:** November 14, 2026. References include the Kasana-modified MoneyMatter v0.33.14 codebase, original account documentation in `packages/docs/src/content/docs/accounts/`, Actual Budget, Bank Indonesia, and WCAG 2.2.

## Current implementation status

- **Implemented:** a small corner pencil badge for editing account logos, replacing the dark overlay while preserving the full image as a click target.
- **Implemented:** a shared `form-field-help.vue` component using `ResponsiveDialog` (mobile bottom drawer, desktop dialog) and contextual guidance throughout key account and vehicle form fields.
- **Implemented:** 19 help topics with English and Indonesian translations, practical examples, and risk notes.
- **Implemented:** a more relevant account-category ordering (cash, checking/transaction accounts, savings, credit cards, general, investments, etc.) without changing existing enum values or user records.
- **Implemented:** new payment-type selection no longer assumes a credit card when no account or global preference exists.
- **Not implemented:** separate e-wallet, MPV, LCGC, or local depreciation enum values; changes to account balance calculations. Those require data-model decisions, migrations, and independent regression tests.
- **Not yet fully validated:** Vue build, automated UI tests, mobile touch/keyboard/small-screen QA. No Docker production images or financial data were deliberately modified.

## Accounts, spending categories, and budgets are different

An **account** records where money or debt actually resides: BCA, DANA, cash, a broker, or a lender. An **expense category** records why money was spent, such as food or transport. A **budget** allocates spending capacity. An **investment portfolio** tracks holdings and values.

Avoid counting the same investment holdings again as a conventional bank balance if they are already included in net worth.

For example, a monthly food budget of Rp600,000 might draw from BCA, DANA, and cash. Create those three accounts and a Food category, rather than three duplicate copies of the food budget balance.

## Account categories relevant to Indonesia — proposed later work

Potential categories include checking/transaction accounts, e-money and e-wallets, cash, savings/deposits, credit cards, brokerage/investment accounts, crypto, and other.

In Indonesia, *giro* refers to a specific bank account mechanism, not every personal savings account. A true e-wallet category requires its own enum or compatible data model; renaming the existing `general` label alone is misleading.

Preserve legacy categories for existing records. Uncommon types can be grouped under an advanced or Other section rather than removed.

## Payment method is not a funding account

QRIS is a **payment channel**, not a balance category. A QRIS transaction may draw from a bank deposit, card, credit facility, or e-money. A QRIS payment funded by BCA should be recorded against the **BCA account**, with the correct expense category—not automatically as a DANA balance.

## Credit limits are not available cash

`creditLimit` represents a credit facility such as a credit card or overdraft, not a positive asset. Example: a Rp10 million limit and a Rp2 million bill imply Rp8 million unused limit, but the outstanding debt remains Rp2 million.

The existing `Include credit limits in balance` behavior can subtract credit limits from balances that already include them. If an account already records Rp2 million of debt, subtracting another Rp10 million can create double-counting. The interface must explain its configuration clearly.

**Proposed future improvement:** show `creditLimit` only for relevant account types and preview the balance impact. Update tests before changing schema expectations.

## Vehicle data model — future Indonesia-specific design

The inherited enum combines body style, price segment, and powertrain: sedan, SUV, truck, luxury, EV, motorcycle, and other. A more useful future schema could separate:

- **Vehicle kind:** passenger car, motorcycle, commercial vehicle, other.
- **Car body:** MPV, SUV, sedan, hatchback, city car, pickup, minibus, van; LCGC is a market/policy segment, not a body shape.
- **Motorcycle kind:** scooter, underbone, sport, trail, electric, other.
- **Powertrain:** petrol, diesel, hybrid, electric; independent of body style.
- **Identity and condition:** brand, model, trim, model year, purchase date, purchase price, odometer, and condition.

Do not quietly map MPV/LCGC onto `VEHICLE_CLASS.other` while claiming accurate Indonesia-specific depreciation. That would make projections misleading.

## Current vehicle depreciation behavior

The inherited values in `packages/shared/src/types/vehicles.ts` use overseas-style example curves (for instance, sedan 20% in year one and 15% in year two of remaining value). `Slow` uses a 0.7 multiplier and `Fast` uses 1.3; `Custom` applies a constant annual percentage.

`salvageFloorPct` sets a projected lower bound, **not** a guaranteed resale price. `currentMileage` is stored for reference but is **not** included in depreciation calculations. The estimate uses the entered purchase price and purchase date, including for used vehicles. Original documentation states purchase price/date/currency cannot be edited after vehicle creation.

Present these limitations clearly. A future valuation feature should use dated, sourced Indonesian market comparisons and allow manual corrections rather than claiming these inherited curves are locally accurate.

## Indonesian used-vehicle evidence — and why the default curves remain provisional

A follow-up review found useful local evidence, but not enough to safely replace every inherited curve with a new Indonesian rate table.

| Source | What it actually measures | Useful signal | Limitation before using it as a default curve |
|---|---|---|---|
| LPEM FEB UI presentation at GIIAS 2025, using OLX listings | Used asking prices from 2016–2024 compared with the **2025 new-car price** (set to 100%) for selected Toyota/Honda segments | Retained-price ratios differ materially by segment. Toyota MPV1 (Avanza) is shown at 81.8% for 2024 and 53.0% for 2016. | The denominator is the 2025 new price, not each vehicle's original purchase/MSRP in its model year. These ratios are not direct annual depreciation rates. Coverage is limited to selected models/segments. |
| Baharsyah (2026), hedonic pricing study using OLX Autos listings | 150 valid January 2025 asking-price observations from Toyota, Honda, Mitsubishi and Daihatsu MPV/SUV listings | The pooled model reports about 7.2% lower asking price per additional year and 3.1% per additional 10,000 km; automatic transmission and Toyota indicators also affect price. | Asking prices are not completed transactions; physical condition is not measured; the Toyota indicator is too broad to distinguish models; the sample is limited to MPV/SUV and four brands. The paper itself recommends transaction/auction data for stronger valuation. |
| GAIKINDO report quoting OLXmobbi (November 2025) | Platform-reported market observations for ICE, hybrid and BEV vehicles | It reports ICE/HEV annual declines around 10–15% and BEV declines around 35–60%. | The article does not publish the sample, observation window, model mix or calculation method. Treat as an industry signal, not a directly reproducible coefficient. |
| iSeeCars 2026 study | More than 950,000 five-year-old vehicles sold in the **United States** from March 2025 to February 2026 | Reports 41.8% average five-year depreciation, 57.2% for EVs, 44.9% for SUVs, 34.2% for trucks and 35.4% for hybrids. | Stronger sample size, but it is US market data and cannot be copied directly into Indonesian curves. |

### Product decision

- Keep the existing class curves as **generic directional heuristics** for now; do not present them as Indonesian market prices.
- Do not add new MPV, LCGC, hatchback, bus or motorcycle coefficients from the evidence above. The available sources do not provide a sufficiently broad, transaction-based and comparable rate table for all those classes.
- Keep the manual custom-rate and value-override paths available. A dated appraisal or a real local market comparison is more defensible than pretending a generic curve is a live quote.
- A future Indonesia-calibrated model should collect model/trim, model year, acquisition date and price, odometer, condition, transmission, document completeness, service history, powertrain, location and observation date. Prefer completed transaction/auction prices; if only listings are available, explicitly model asking-price bias. Publish sample size, source date and confidence range.
- The current projection is an **ownership book-value estimate** anchored to purchase price/date and the selected curve. It is not a market resale valuation. Model year and odometer are currently recorded for reference but do not change the depreciation formula.

### Sources

- LPEM FEB UI / GIIAS 2025 presentation, “Harga Mobil Baru vs Harga Mobil Bekas tahun 2025” (data source: OLX): https://www.gaikindo.or.id/wp-content/uploads/2025/07/03.-Riyanto_Paparan-GIIAS-2025_kirimV1.pdf
- Saefuddin Baharsyah, “Faktor-Faktor Penentu Nilai Pasar Kendaraan Roda Empat Bekas: Pendekatan Hedonic Pricing Model pada Segmen MPV dan SUV di Indonesia”, IPSSJ Vol. 3 No. 3 (2026): https://ipssj.com/index.php/ojs/article/download/1253/1193
- GAIKINDO / OLXmobbi, “Used Car Market Still Ruled by Conventional and Hybrid Models” (18 November 2025): https://www.gaikindo.or.id/en/used-car-market-still-ruled-by-conventional-and-hybrid-models/
- iSeeCars, “The Top 25 Cars That Hold Their Value Best – and the 25 Worst” (24 March 2026): https://www.iseecars.com/cars-that-hold-their-value-study

## Acceptance criteria before merge

- `vue-tsc --noEmit` and `vite build` complete successfully.
- Help controls open the correct responsive dialog/drawer without submitting forms and support keyboard dismissal and the component's mobile interactions.
- Examples and labels remain accurate in both Indonesian and English modes.
- Selected logos (icon, initials, brand, uploaded image) remain visible, with a usable pencil control and no dark overlay.
- Account forms submit valid enum, credit-limit, and payment defaults; vehicle form payloads remain backward compatible.
- Modal dropdowns are scrollable and remain inside the viewport.
- No database migrations or financial-balance modifications are introduced by these UI changes.

## References

- https://actualbudget.org/docs/getting-started/starting-fresh/
- https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/instrumen/default.aspx
- https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/kanal-layanan/qris/default.aspx
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
