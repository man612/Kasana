# Kasana Guide — Accounts, Budgets, Savings Goals, and Debt in Indonesia

**Design reference, November 10, 2026.** Based on the Kasana-modified MoneyMatter v0.33.14 codebase. Figures are illustrative, not real user data. The combined UI changes remain under review in [PR #10](https://github.com/man612/Kasana/pull/10).

## 1. Three different layers of personal finance

1. **Accounts** answer *where the money or debt actually is*: BCA, BRI, DANA, GoPay, cash, brokerage accounts, and obligations to SPayLater or Kredivo.
2. **Budgets** answer *how much may be spent for a purpose*: food, entertainment, mobile credit, or transportation. A single budget can involve multiple funding accounts. Each transaction reduces the chosen account's balance and the remaining budget for its category.
3. **Savings goals** answer *what the money is being reserved for*: emergency funds, a laptop, a motorcycle, etc. Goals measure assigned portions of account balances without physically transferring the funds.

**Do not create a fictitious "Food Money" account holding the same rupiah already tracked in BCA or DANA.** That would double-count assets. A separate account is appropriate only when it truly represents a distinct balance that can be reconciled.

### Example across several accounts

| Real balance source | Balance |
| --- | ---: |
| BCA | Rp2,000,000 |
| DANA | Rp400,000 |
| Cash | Rp300,000 |
| Mutual-fund portfolio | Rp1,500,000 |

- Create the four real balance sources **once**. Do not add an extra savings account that repeats an investment holding already included in net worth.
- In **Planning → Budgets**, select the relevant cash accounts and create lines such as **Food** Rp600,000/month and **Entertainment** Rp300,000/month. Set rollover behavior deliberately.
- In **Planning → Goals**, create goals such as **Emergency Fund** and **Laptop**, assigning portions of supporting balances.
- The inherited `packages/frontend/src/pages/goals/components/goal-accounts-dialog.vue` supports **percentage** and **fixed-amount** allocations per account. Choose based on the intended behavior. A fixed allocation of Rp500,000 from BCA, Rp200,000 from DANA, and Rp300,000 from investments gives Rp1,000,000 progress toward a Rp2,000,000 laptop goal.
- A percentage allocation of 25% BCA + 50% DANA + 20% investment value also yields Rp1,000,000 with the example balances, but changes as each source balance changes.
- Multiple **fixed allocations** from one account are allowed and have **priority order**. Earlier allocations take available capacity up to their configured amount; subsequent allocations may shrink when funds are insufficient. Percentage allocations are then computed from the remainder. These are tracking rules, **not physical fund locks**.
- The total percentage allocated from one account to several active or paused goals is limited to **100%**. Fixed allocations use their own priority/capacity mechanism, not a percentage sum.
- **Budgets and Goals do not reserve funds against each other.** Assigning Rp600,000 to Food and claiming the exact same money for a Laptop goal can make a plan exceed real available cash.
- For a fixed-amount goal, another bank account is unnecessary if you understand that money remains at its source and goal progress can fall when the underlying account balance falls.
- When spending Rp35,000 from DANA on food, record a **Rp35,000 expense against DANA with category Food**. This reduces both the DANA balance and the available Food budget. Do not invent a withdrawal from a separate "Food Budget" account.

Related upstream docs: `packages/docs/src/content/docs/budgeting/start-budgeting.mdx`, `budgeting/assigning-and-rollover.mdx`, `goals/create-and-edit.mdx`, and `goals/how-progress-is-calculated.mdx`.

## 2. Distinguish three forms of debt

| Debt type | Example | Accounting approach |
| --- | --- | --- |
| **Purchase financing / paylater** | Kredivo installments, Shopee SPayLater | Track the outstanding liability and purchases/fees; payments from BCA are transfers that reduce the debt |
| **Cash loans** | KrediFazz, Shopee SPinjam | Separate contractual principal, actual cash received, deducted fees, and installment components |
| **Revolving credit** | Credit cards | Track charged purchases, refunds, interest, bill payments, and outstanding debt; a credit limit is not cash |

**SPayLater (PT Commerce Finance) and SPinjam (PT Lentera Dana Nusantara) are different products.** KrediFazz operates in the Kredivo ecosystem, but lenders, rates, terms, and fees can vary by contract. Use the actual provider disclosure, not a generic rate found online.

## 3. Recording purchase paylater in the current app

Hypothetical scenario: an item costs Rp600,000, the provider charges a Rp30,000 fee, and you pay Rp210,000 from BCA.

1. Create a **manual account named SPayLater** (use the Credit Card category for an ongoing liability, or General if that classification does not fit). Start with zero balance if no debt has been recorded. **Never enter the credit limit as the opening balance.**
2. Record a **Rp600,000 expense** in the SPayLater account, using an appropriate item category. The tracked balance becomes **−Rp600,000**.
3. When the Rp30,000 fee is formally charged, record a financing-cost expense against SPayLater. The liability becomes **−Rp630,000**.
4. When paying Rp210,000 from BCA, create a **BCA → SPayLater transfer**. BCA decreases by Rp210,000; the remaining SPayLater balance becomes **−Rp420,000**.
5. **Do not record the transfer as another shopping expense**: the purchase was already counted in step 2. If tracking begins after some installments have been paid, initialize the SPayLater account with the true outstanding **negative** balance and record only subsequent transactions.

If some future fees or interest have not yet accrued under the contract, do not arbitrarily recognize all future charges as current debt. Reconcile against the provider's official statements and accounting treatment.

## 4. Recording cash loans and avoiding incorrect interest assumptions

Suppose a loan contract specifies **Rp1,000,000 principal** and deducts **Rp60,000 upfront fees**, so only **Rp940,000** reaches the bank. These values are not interchangeable. If tracking begins after disbursement, enter the observed bank balance with a proper opening-balance or adjustment note and separately record the actual liability. **Do not classify loan disbursement as salary or earned income.**

The current **Loans** feature stores original principal, outstanding balance, APR, term, monthly/minimum payment, due dates, and lender. Its projection uses declining-principal amortization, while the inherited `LoanPayment` logic treats loan payments as reductions of principal.

**Payment example:** if a Rp360,000 installment includes Rp300,000 principal and Rp60,000 interest/fees, record Rp300,000 as principal repayment and Rp60,000 as financing cost from the bank. Recording Rp360,000 as principal reduction **and** another Rp60,000 fee would misstate debt and spending.

A contractual **flat monthly interest rate of 2.6%** cannot simply be entered as a **31.2% APR** into a declining-balance calculator; those are different pricing conventions. Do not enter 0% just because the true effective rate is unknown. If principal and interest are not separately disclosed, track actual balances and billed charges manually rather than relying on automatic loan projections.

### Gaps requiring a separate implementation phase

- Cash loans lack an integrated flow for **contractual principal → net disbursement → deducted upfront fees → outstanding liability** without manually constructing transactions.
- The loan form requires APR. Users with flat interest or unknown effective rates cannot obtain accurate projections without suitable calculation logic.
- Current loan payments reduce principal by 100%. An Indonesian loan model needs **installment allocation across principal, interest, administration fees, and late fees**.
- Paylater providers may contain **multiple independent purchases or installment contracts**, each with distinct rates and billing dates. Combining them into one forecast can mislead.
- Reminders should follow official due dates and billing calendars, not only a fixed day of the month.
- Reports must not count unused credit limits as assets.

## 5. Form guidance implemented in historical PR #8

- Field-by-field help for accounts, vehicles, and loans using the application's responsive dialog/drawer.
- A flat-interest warning near the beginning of the Loan form.
- The default new loan type changes to **Personal**, not Mortgage.
- Short installment-term presets: **1, 2, 3, 6, 9, 12, 18, and 24 months**, alongside longer multi-year terms. The menu has a capped, scrollable height.
- Local provider examples: Kredivo, KrediFazz, and SPayLater.
- The existing calculation engine and database were **not** replaced. These changes do **not** imply that APR, liabilities, and paylater schedules are automatically modeled correctly.

## 6. Priorities for later product development

1. Finish visual/form quality checks and run builds, unit tests, and mobile QA before merging.
2. Make onboarding explain **Real Accounts → Budgets → Savings Goals** without duplicating balances.
3. Add a genuine **E-wallet** account type to the data model, rather than merely renaming General, with backward compatibility for old enums.
4. Distinguish **purchase paylater contracts** from **cash loans** and support each contract's outstanding balance and billing dates.
5. Separate installment components and avoid estimating APR when a contract lacks the necessary information.
6. Add bill reminders and balance reconciliation; test calculation modules against representative Indonesian contract scenarios.

## References

- `packages/shared/src/types/loans.ts`; `packages/backend/src/common/loans/projection.ts`; `packages/frontend/src/pages/loans/components/loan-form.vue`; `.../loan-payment-form.vue`.
- [Kredivo FAQ](https://www.kredivo.com/faqs/)
- [Shopee SPayLater product disclosure](https://help.shopee.co.id/portal/4/article/145891)
- [Shopee SPinjam](https://help.shopee.co.id/portal/4/article/72485-%5BSPinjam%5D-Apa-itu-SPinjam%3F)
- [Actual Budget: envelope budgeting](https://actualbudget.org/docs/budgeting/)
- [OJK Regulation 40/2024](https://ojk.go.id/id/regulasi/Pages/POJK-40-Tahun-2024-Layanan-Pendanaan-Bersama-Berbasis-Teknologi-Informasi.aspx)

**These examples are educational bookkeeping guidance, not contractual, accounting, legal, or lending advice. Verify each provider statement and real transaction before entering liabilities.**
