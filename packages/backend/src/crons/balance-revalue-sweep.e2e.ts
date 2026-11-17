import { ACCOUNT_CATEGORIES, TRANSACTION_TYPES, VEHICLE_CLASS, asDecimal } from '@bt/shared/types';
import { describe, expect, it } from '@jest/globals';
import Accounts from '@models/accounts.model';
import { connection } from '@models/connection';
import { runBalanceRevalueSweep } from '@root/crons/balance-revalue-sweep';
import * as helpers from '@tests/helpers';
import { getLunchFlowBalanceMock, getLunchFlowTransactionsMock } from '@tests/mocks/lunchflow/mock-api';
import { format, subDays, subYears } from 'date-fns';
import { QueryTypes } from 'sequelize';
import { v7 as uuidv7 } from 'uuid';

/** The sweep has no HTTP surface, so this e2e invokes it directly. */

const CORRUPTED_CENTS = 99_999_900;

const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

const writeBalanceRow = async ({ accountId, date, cents }: { accountId: string; date: Date; cents: number }) => {
  await connection.sequelize.query(
    `INSERT INTO "Balances" ("id", "accountId", "date", "amount", "createdAt", "updatedAt")
     VALUES (:id, :accountId, :date, :amount, NOW(), NOW())
     ON CONFLICT ("accountId", "date") DO UPDATE SET "amount" = EXCLUDED."amount"`,
    { replacements: { id: uuidv7(), accountId, date: dayKey(date), amount: cents } },
  );
};

const readBalanceRow = async ({ accountId, date }: { accountId: string; date: Date }): Promise<number | null> => {
  const [row] = (await connection.sequelize.query(
    `SELECT "amount"::bigint AS "cents" FROM "Balances" WHERE "accountId" = :accountId AND "date" = :date`,
    { type: QueryTypes.SELECT, replacements: { accountId, date: dayKey(date) } },
  )) as { cents: string }[];

  return row ? Number(row.cents) : null;
};

const LUNCHFLOW_EXTERNAL_ACCOUNT_ID = 1001;
const BANK_BALANCE = 1000.5;

const connectBankAccount = async ({ currency }: { currency: string }): Promise<Accounts> => {
  global.mswMockServer.use(
    getLunchFlowTransactionsMock({ response: { transactions: [], total: 0 } }),
    getLunchFlowBalanceMock({
      accountId: LUNCHFLOW_EXTERNAL_ACCOUNT_ID,
      response: { balance: { amount: asDecimal(BANK_BALANCE), currency } },
    }),
  );

  const { connectionId } = await helpers.lunchflow.pair();
  const { syncedAccounts } = await helpers.bankDataProviders.connectSelectedAccounts({
    connectionId,
    accountExternalIds: [String(LUNCHFLOW_EXTERNAL_ACCOUNT_ID)],
    raw: true,
  });

  return (await Accounts.findByPk(syncedAccounts[0]!.id))!;
};

const setAccountCategory = async ({ accountId, category }: { accountId: string; category: ACCOUNT_CATEGORIES }) => {
  await connection.sequelize.query(`UPDATE "Accounts" SET "accountCategory" = :category WHERE "id" = :accountId`, {
    replacements: { accountId, category },
  });
};

describe('Nightly balance revalue sweep', () => {
  it('rebuilds a foreign-currency account, dropping a value it did not compute', async () => {
    const { account } = await helpers.createAccountWithNewCurrency({ currency: 'UAH' });

    await helpers.createTransaction({
      payload: helpers.buildTransactionPayload({
        accountId: account.id,
        amount: 1000,
        time: subDays(new Date(), 10).toISOString(),
      }),
      raw: true,
    });

    const corruptedDay = subDays(new Date(), 5);
    await writeBalanceRow({ accountId: account.id, date: corruptedDay, cents: CORRUPTED_CENTS });

    const result = await runBalanceRevalueSweep();

    expect(result.totalProcessed).toBe(1);
    expect(result.successfulUpdates).toBe(1);
    expect(result.failedUpdates).toBe(0);

    // The rebuild owns every day from the grid start on: the corrupted row is either
    // rewritten with the day's real value or deleted as a day that carries no change.
    expect(await readBalanceRow({ accountId: account.id, date: corruptedDay })).not.toBe(CORRUPTED_CENTS);
  });

  it('revalues legacy five-decimal IDR history during the nightly sweep and produces stable repeat values', async () => {
    // Isolated synthetic USD-pivot fixtures, NOT historical/live market quotes:
    // USD 1 = IDR 16,000 and USD 1 = AED 3.6.
    // Old IDR -> AED: 0.00022; corrected reciprocal: 0.000225.
    const historicalDay = subDays(new Date(), 5);
    const today = new Date();
    const legacyCents = 22_000; // AED 220.00 under the old five-decimal formatter
    const correctedCents = 22_500; // AED 225.00 for IDR 1,000,000
    const dates = [historicalDay, today];

    try {
      for (const date of dates) {
        await helpers.seedUsdExchangeRates({ date, ratesPerUsd: { IDR: 16_000, AED: 3.6 } });
      }
      await helpers.addUserCurrencies({ currencyCodes: ['IDR'] });
      const account = await helpers.createAccount({
        payload: helpers.buildAccountPayload({ currencyCode: 'IDR', initialBalance: 1_000_000 }),
        raw: true,
      });

      // Simulate an existing old-format snapshot. The account's native IDR
      // opening balance is unchanged; only these derived AED rows are stale.
      for (const date of dates) {
        await writeBalanceRow({ accountId: account.id, date, cents: legacyCents });
        expect(await readBalanceRow({ accountId: account.id, date })).toBe(legacyCents);
      }

      const firstRun = await runBalanceRevalueSweep();
      expect(firstRun.totalProcessed).toBe(1);
      expect(firstRun.successfulUpdates).toBe(1);
      expect(firstRun.failedUpdates).toBe(0);

      // This proves that merely enabling the new formatter can change stored
      // historical Balances automatically, without editing a transaction.
      for (const date of dates) {
        expect(await readBalanceRow({ accountId: account.id, date })).toBe(correctedCents);
      }

      const secondRun = await runBalanceRevalueSweep();
      expect(secondRun.totalProcessed).toBe(1);
      expect(secondRun.successfulUpdates).toBe(1);
      expect(secondRun.failedUpdates).toBe(0);
      for (const date of dates) {
        expect(await readBalanceRow({ accountId: account.id, date })).toBe(correctedCents);
      }

      // A revaluation updates reference-currency history, not native holdings.
      const unchanged = await Accounts.findByPk(account.id);
      expect(unchanged?.initialBalance.toCents()).toBe(100_000_000);
      expect(unchanged?.currentBalance.toCents()).toBe(100_000_000);
    } finally {
      await helpers.clearExchangeRatesForDates({ dates });
    }
  }, 60_000);

  it('keeps legacy transaction refAmount unchanged when revaluing IDR history from native cents', async () => {
    // Synthetic historical scenario: a pre-fix transaction stores AED 44.00
    // for a 200,000 IDR expense (old rate 0.00022), while corrected market
    // valuation is AED 45.00 (rate 0.000225). The nightly sweep must change
    // derived Balances, NOT silently rewrite past transaction refAmount.
    const pastDay = subDays(new Date(), 10);
    const today = new Date();
    const seededDates = [pastDay, today];

    try {
      for (const date of seededDates) {
        await helpers.seedUsdExchangeRates({ date, ratesPerUsd: { IDR: 16_000, AED: 3.6 } });
      }
      await helpers.addUserCurrencies({ currencyCodes: ['IDR'] });
      const account = await helpers.createAccount({
        payload: helpers.buildAccountPayload({ currencyCode: 'IDR', initialBalance: 1_000_000 }),
        raw: true,
      });
      const [expense] = await helpers.createTransaction({
        payload: helpers.buildTransactionPayload({
          accountId: account.id,
          transactionType: TRANSACTION_TYPES.expense,
          amount: 200_000,
          time: pastDay.toISOString(),
        }),
        raw: true,
      });

      // Replay a stored pre-fix ref amount without changing the authoritative
      // native amount. Raw SQL is confined to this disposable E2E database.
      await connection.sequelize.query(
        `UPDATE "Transactions" SET "refAmount" = :oldRefCents WHERE "id" = :transactionId`,
        { replacements: { oldRefCents: 4_400, transactionId: expense.id } },
      );
      await writeBalanceRow({ accountId: account.id, date: pastDay, cents: 17_600 });
      expect(await readBalanceRow({ accountId: account.id, date: pastDay })).toBe(17_600);

      const result = await runBalanceRevalueSweep();
      expect(result.totalProcessed).toBe(1);
      expect(result.successfulUpdates).toBe(1);
      expect(result.failedUpdates).toBe(0);

      // 1m - 200k = 800k native IDR; 800k * (3.6 / 16000) = AED 180.
      expect(await readBalanceRow({ accountId: account.id, date: pastDay })).toBe(18_000);
      expect(await readBalanceRow({ accountId: account.id, date: today })).toBe(18_000);

      const [stored] = (await connection.sequelize.query(
        `SELECT "amount"::bigint AS "nativeCents", "refAmount"::bigint AS "refCents"
           FROM "Transactions" WHERE "id" = :transactionId`,
        { type: QueryTypes.SELECT, replacements: { transactionId: expense.id } },
      )) as { nativeCents: string; refCents: string }[];
      expect(Number(stored!.nativeCents)).toBe(20_000_000);
      expect(Number(stored!.refCents)).toBe(4_400); // old stored amount deliberately retained

      const unchangedAccount = await Accounts.findByPk(account.id);
      expect(unchangedAccount!.initialBalance.toCents()).toBe(100_000_000);
      expect(unchangedAccount!.currentBalance.toCents()).toBe(80_000_000);
    } finally {
      await helpers.clearExchangeRatesForDates({ dates: seededDates });
    }
  }, 60_000);

  it('re-values today for a foreign-currency bank account the provider did not sync', async () => {
    const today = new Date();
    await helpers.seedUsdExchangeRates({ date: today, ratesPerUsd: { AED: helpers.AED_PER_USD } });

    const account = await connectBankAccount({ currency: 'USD' });
    await writeBalanceRow({ accountId: account.id, date: today, cents: CORRUPTED_CENTS });

    const result = await runBalanceRevalueSweep();

    expect(result.totalProcessed).toBe(1);
    expect(result.successfulUpdates).toBe(1);
    expect(await readBalanceRow({ accountId: account.id, date: today })).toBe(
      account.currentBalance.toCents() * helpers.AED_PER_USD,
    );
  });

  it('leaves a bank account in the base currency alone', async () => {
    const today = new Date();
    const account = await connectBankAccount({ currency: global.BASE_CURRENCY.code });

    await writeBalanceRow({ accountId: account.id, date: today, cents: CORRUPTED_CENTS });

    const result = await runBalanceRevalueSweep();

    expect(result.totalProcessed).toBe(0);
    expect(await readBalanceRow({ accountId: account.id, date: today })).toBe(CORRUPTED_CENTS);
  });

  it('skips base-currency accounts, loans that own their balance history and vehicles on a depreciation curve', async () => {
    const baseCurrencyAccount = await helpers.createAccount({
      payload: helpers.buildAccountPayload({ currencyCode: global.BASE_CURRENCY.code }),
      raw: true,
    });

    // Also registers UAH for the user — the vehicle below relies on it; keep this before the vehicle.
    const { account: loanAccount } = await helpers.createAccountWithNewCurrency({ currency: 'UAH' });
    await setAccountCategory({ accountId: loanAccount.id, category: ACCOUNT_CATEGORIES.loan });

    const vehicle = await helpers.createVehicle({
      name: 'Toyota Camry 2020',
      currencyCode: 'UAH',
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      vehicleClass: VEHICLE_CLASS.sedan,
      purchasePrice: 25000,
      purchaseDate: format(subYears(new Date(), 3), 'yyyy-MM-dd'),
      raw: true,
    });

    const untouchedDay = subDays(new Date(), 5);
    const skippedAccountIds = [baseCurrencyAccount.id, loanAccount.id, vehicle.accountId];

    for (const accountId of skippedAccountIds) {
      await writeBalanceRow({ accountId, date: untouchedDay, cents: CORRUPTED_CENTS });
    }

    const result = await runBalanceRevalueSweep();

    expect(result.totalProcessed).toBe(0);

    for (const accountId of skippedAccountIds) {
      expect(await readBalanceRow({ accountId, date: untouchedDay })).toBe(CORRUPTED_CENTS);
    }
  }, 30_000);
});
