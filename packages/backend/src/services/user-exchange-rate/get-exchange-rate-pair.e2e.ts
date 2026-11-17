import { EXCHANGE_RATE_PROVIDER_TYPE } from '@bt/shared/types';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import { connection } from '@models/index';
import * as helpers from '@tests/helpers';
import { Money } from '@common/types/money';
import { redisClient } from '@root/redis-client';
import { calculateRefAmount } from '@services/calculate-ref-amount.service';
import { endOfDay, startOfDay } from 'date-fns';

/**
 * `GET /currencies/rates/pair` answers "what is 1 `from` worth in `to` on this date?" for any
 * ISO pair, including currencies the user never connected. Most of these tests pin that waiver.
 *
 * The date is far from the historical seed (which lands 10 days before the migration ran), so
 * each test fully owns the rows it inserts there. Those rows are `api-layer`-sourced, which also
 * marks the date comprehensively fetched and keeps the resolver off the mocked providers even
 * when a leg is unresolved.
 */
const RATE_DATE = '2020-03-15';
const EARLIER_RATE_DATE = '2020-03-10';
const USD_TO_AED = 3.6;
const USD_TO_JPY = 150;
const USD_TO_EUR = 0.9;
const USD_TO_FALLBACK_ONLY = 500;

/** Left with no rate on any date, so the lookup has nothing to resolve. */
const UNPRICED = 'XAF';
/** Left with a rate on `EARLIER_RATE_DATE` only, so a `RATE_DATE` lookup must substitute it. */
const FALLBACK_ONLY = 'XOF';

// `ExchangeRates` holds seed data that is never truncated between suites, and both codes below
// are seeded. The suite captures those rows once before deleting them and puts them back when it
// finishes, so no later suite loses a rate it expects to be there.
const SUITE_OWNED_CODES = [UNPRICED, FALLBACK_ONLY];

type StoredRate = {
  baseCode: string;
  quoteCode: string;
  date: Date;
  rate: number;
  source: EXCHANGE_RATE_PROVIDER_TYPE;
};

let seededRates: StoredRate[] = [];

const insertRate = async ({
  quoteCode,
  rate,
  date = RATE_DATE,
}: {
  quoteCode: string;
  rate: number;
  date?: string;
}) => {
  await connection.sequelize.query(
    `INSERT INTO "ExchangeRates" ("baseCode", "quoteCode", "date", "rate", "source")
     VALUES ('USD', :quoteCode, :date, :rate, :source)`,
    {
      replacements: {
        quoteCode,
        date: new Date(date),
        rate,
        source: EXCHANGE_RATE_PROVIDER_TYPE.API_LAYER,
      },
    },
  );
};

const deleteRatesOnRateDate = async () => {
  const day = new Date(RATE_DATE);
  await connection.sequelize.query(`DELETE FROM "ExchangeRates" WHERE "date" >= :start AND "date" <= :end`, {
    replacements: { start: startOfDay(day), end: endOfDay(day) },
  });
};

const readRatesFor = async ({ quoteCodes }: { quoteCodes: string[] }): Promise<StoredRate[]> => {
  const [rows] = await connection.sequelize.query(
    `SELECT "baseCode", "quoteCode", "date", "rate", "source"
     FROM "ExchangeRates" WHERE "quoteCode" IN (:quoteCodes)`,
    { replacements: { quoteCodes } },
  );

  return rows as StoredRate[];
};

const deleteRatesFor = async ({ quoteCodes }: { quoteCodes: string[] }) => {
  await connection.sequelize.query(`DELETE FROM "ExchangeRates" WHERE "quoteCode" IN (:quoteCodes)`, {
    replacements: { quoteCodes },
  });
};

const restoreRates = async ({ rates }: { rates: StoredRate[] }) => {
  if (!rates.length) return;

  const replacements: Record<string, unknown> = {};
  const rows = rates.map((rate, index) => {
    replacements[`baseCode${index}`] = rate.baseCode;
    replacements[`quoteCode${index}`] = rate.quoteCode;
    replacements[`date${index}`] = rate.date;
    replacements[`rate${index}`] = rate.rate;
    replacements[`source${index}`] = rate.source;

    return `(:baseCode${index}, :quoteCode${index}, :date${index}, :rate${index}, :source${index})`;
  });

  await connection.sequelize.query(
    `INSERT INTO "ExchangeRates" ("baseCode", "quoteCode", "date", "rate", "source")
     VALUES ${rows.join(', ')}`,
    { replacements },
  );
};

describe('GET /currencies/rates/pair', () => {
  // Never move this capture into beforeEach: a read that runs after any deletion snapshots an
  // empty set, and the seeded rows are then gone for the rest of the worker run.
  beforeAll(async () => {
    seededRates = await readRatesFor({ quoteCodes: SUITE_OWNED_CODES });
    await deleteRatesFor({ quoteCodes: SUITE_OWNED_CODES });
  });

  afterAll(async () => {
    await deleteRatesFor({ quoteCodes: SUITE_OWNED_CODES });
    await restoreRates({ rates: seededRates });
  });

  beforeEach(async () => {
    await deleteRatesFor({ quoteCodes: SUITE_OWNED_CODES });
    await deleteRatesOnRateDate();

    await insertRate({ quoteCode: global.BASE_CURRENCY_CODE, rate: USD_TO_AED });
    await insertRate({ quoteCode: 'JPY', rate: USD_TO_JPY });
  });

  afterEach(async () => {
    await deleteRatesOnRateDate();
  });

  it('returns the rate for a currency the user has connected', async () => {
    const result = await helpers.getExchangeRatePair({
      from: global.BASE_CURRENCY_CODE,
      to: 'USD',
      date: RATE_DATE,
      raw: true,
    });

    expect(result.baseCode).toBe(global.BASE_CURRENCY_CODE);
    expect(result.quoteCode).toBe('USD');
    expect(result.rate).toBeCloseTo(1 / USD_TO_AED, 4);
  });

  it('preserves synthetic IDR->USD and IDR->AED precision without truncating valid reciprocal rates', async () => {
    // Synthetic fixed-rate fixture; this is NOT a live USD/IDR quote.
    // In the old 5-decimal formatter: 1/16,000 became 0.00006 (-4%).
    await insertRate({ quoteCode: 'IDR', rate: 16_000 });

    const toUsd = await helpers.getExchangeRatePair({
      from: 'IDR',
      to: 'USD',
      date: RATE_DATE,
      raw: true,
    });
    expect(toUsd.baseCode).toBe('IDR');
    expect(toUsd.quoteCode).toBe('USD');
    expect(toUsd.rate).toBeCloseTo(1 / 16_000, 10);

    const toBase = await helpers.getExchangeRatePair({
      from: 'IDR',
      to: global.BASE_CURRENCY_CODE,
      date: RATE_DATE,
      raw: true,
    });
    expect(toBase.rate).toBeCloseTo(USD_TO_AED / 16_000, 10);
  });

  it('does not reuse an old cached 60 USD refAmount after the IDR rate precision fix', async () => {
    // A legacy v1 cached conversion could survive an application update for one hour.
    // Use synthetic rows and Redis only; never touch operator or financial records.
    await insertRate({ quoteCode: 'IDR', rate: 16_000 });
    const currencies = await helpers.getUserCurrencies();
    if (!currencies.some((item) => item.currencyCode === 'IDR')) {
      await helpers.addUserCurrencies({ currencyCodes: ['IDR'] });
    }
    const owner = await helpers.getUserInfo({ raw: true });
    const legacyKey = `ref_amount:${owner.id}:100000000:IDR:USD:${RATE_DATE}`;
    const activeKey = `ref_amount:v2:${owner.id}:100000000:IDR:USD:${RATE_DATE}`;

    await redisClient.del(activeKey);
    await redisClient.set(legacyKey, '6000'); // old 60.00 USD = 6,000 cents

    try {
      const converted = await calculateRefAmount({
        userId: owner.id,
        amount: Money.fromDecimal(1_000_000),
        date: new Date(RATE_DATE),
        baseCode: 'IDR',
        quoteCode: 'USD',
      });
      // Exact synthetic reciprocal: 1,000,000 IDR / 16,000 = 62.50 USD.
      // This would fail if the legacy ref_amount: key were still read.
      expect(converted.toCents()).toBe(6250);
    } finally {
      await redisClient.del(legacyKey, activeKey);
    }
  });

  it('never reuses amount-cache cents after a custom FX edit, live-rate toggle, or removal', async () => {
    // Synthetic rates only. Previous v2 amount cache would return 60.00 AED
    // even after the owner edits a quote to 300.00/400.00 AED.
    await insertRate({ quoteCode: 'IDR', rate: 16_000 });
    await helpers.addUserCurrencies({ currencyCodes: ['IDR'] });
    const owner = await helpers.getUserInfo({ raw: true });
    const baseCode = global.BASE_CURRENCY_CODE;
    const legacyV2 = `ref_amount:v2:${owner.id}:100000000:IDR:${baseCode}:${RATE_DATE}`;
    const conversion = () =>
      calculateRefAmount({
        userId: owner.id,
        amount: Money.fromDecimal(1_000_000),
        date: new Date(RATE_DATE),
        baseCode: 'IDR',
        // Omitted quote verifies the currently configured base currency resolves correctly.
      });
    const customPairs = (rate: number) => [
      { baseCode: 'IDR', quoteCode: baseCode, rate },
      { baseCode, quoteCode: 'IDR', rate: 1 / rate },
    ];

    await redisClient.del(legacyV2);
    try {
      expect((await conversion()).toCents()).toBe(22_500); // 1m IDR * 3.6/16000
      await redisClient.set(legacyV2, '6000'); // poisoned cents from an old conversion
      expect((await conversion()).toCents()).toBe(22_500); // must not return 6,000 cents

      await helpers.editCurrencyExchangeRate({ pairs: customPairs(0.0003), raw: true });
      expect((await conversion()).toCents()).toBe(30_000);

      await helpers.editCurrencyExchangeRate({ pairs: customPairs(0.0004), raw: true });
      expect((await conversion()).toCents()).toBe(40_000);

      // Switching to live rates must not inherit the previous manual valuation.
      await helpers.updateUserCurrency({ currency: { currencyCode: 'IDR', liveRateUpdate: true }, raw: true });
      expect((await conversion()).toCents()).toBe(22_500);

      await helpers.updateUserCurrency({ currency: { currencyCode: 'IDR', liveRateUpdate: false }, raw: true });
      expect((await conversion()).toCents()).toBe(40_000);

      await helpers.removeCurrencyExchangeRate({
        pairs: [
          { baseCode: 'IDR', quoteCode: baseCode },
          { baseCode, quoteCode: 'IDR' },
        ],
        raw: true,
      });
      expect((await conversion()).toCents()).toBe(22_500);
      // A stale entry can remain in Redis until TTL; conversions never consume it.
      expect(await redisClient.get(legacyV2)).toBe('6000');
    } finally {
      await redisClient.del(legacyV2);
    }
  });

  it('uses the latest PRIOR historical FX publication instead of a later rate', async () => {
    // Date pair is synthetic and deliberately brackets the requested day.
    // Old unbounded DESC selected the newer 1000 XOF/USD quote for 2020-03-15.
    await insertRate({ quoteCode: FALLBACK_ONLY, rate: 500, date: EARLIER_RATE_DATE });
    await insertRate({ quoteCode: FALLBACK_ONLY, rate: 1000, date: '2020-03-20' });
    const result = await helpers.getExchangeRatePair({
      from: FALLBACK_ONLY,
      to: 'USD',
      date: RATE_DATE,
      raw: true,
    });
    expect(result.rate).toBeCloseTo(1 / 500, 10);
    expect(result.date.slice(0, 10)).toBe(EARLIER_RATE_DATE);
  });

  it('uses the earliest available quote if the requested date predates all stored history', async () => {
    // Avoid treating the LATEST future price as if it were the oldest known one.
    await insertRate({ quoteCode: UNPRICED, rate: 600, date: '2020-03-20' });
    await insertRate({ quoteCode: UNPRICED, rate: 900, date: '2020-04-20' });
    const result = await helpers.getExchangeRatePair({
      from: UNPRICED,
      to: 'USD',
      date: RATE_DATE,
      raw: true,
    });
    expect(result.rate).toBeCloseTo(1 / 600, 10);
    expect(result.date.slice(0, 10)).toBe('2020-03-20');
  });

  it('returns the rate for a currency the user has NOT connected', async () => {
    const userCurrencies = await helpers.getUserCurrencies();
    expect(userCurrencies.some((item) => item.currencyCode === 'JPY')).toBe(false);

    const result = await helpers.getExchangeRatePair({
      from: 'JPY',
      to: global.BASE_CURRENCY_CODE,
      date: RATE_DATE,
      raw: true,
    });

    expect(result.baseCode).toBe('JPY');
    expect(result.quoteCode).toBe(global.BASE_CURRENCY_CODE);
    expect(result.rate).toBeCloseTo(USD_TO_AED / USD_TO_JPY, 5);

    const lowercased = await helpers.getExchangeRatePair({
      from: 'jpy',
      to: global.BASE_CURRENCY_CODE.toLowerCase(),
      date: RATE_DATE,
      raw: true,
    });

    expect(lowercased.baseCode).toBe('JPY');
    expect(lowercased.quoteCode).toBe(global.BASE_CURRENCY_CODE);
  });

  it('returns 1 when both codes are the same, even for an unconnected currency', async () => {
    const result = await helpers.getExchangeRatePair({ from: 'JPY', to: 'JPY', date: RATE_DATE, raw: true });

    expect(result.rate).toBe(1);
  });

  it('substitutes the nearest earlier rate and reports its date', async () => {
    await insertRate({ quoteCode: FALLBACK_ONLY, rate: USD_TO_FALLBACK_ONLY, date: EARLIER_RATE_DATE });

    const result = await helpers.getExchangeRatePair({
      from: FALLBACK_ONLY,
      to: 'USD',
      date: RATE_DATE,
      raw: true,
    });

    expect(result.rate).toBeCloseTo(1 / USD_TO_FALLBACK_ONLY, 5);
    expect(result.date.slice(0, 10)).toBe(EARLIER_RATE_DATE);
  });

  it("prefers the connected user's custom rate over the market rate", async () => {
    const CUSTOM_EUR_TO_BASE = 5;
    const baseCode = global.BASE_CURRENCY_CODE;

    await helpers.addUserCurrencies({ currencyCodes: ['EUR'] });
    await helpers.updateUserCurrency({ currency: { currencyCode: 'EUR', liveRateUpdate: false }, raw: true });
    await helpers.editCurrencyExchangeRate({
      pairs: [
        { baseCode: 'EUR', quoteCode: baseCode, rate: CUSTOM_EUR_TO_BASE },
        { baseCode: baseCode, quoteCode: 'EUR', rate: 1 / CUSTOM_EUR_TO_BASE },
      ],
    });

    const result = await helpers.getExchangeRatePair({ from: 'EUR', to: baseCode, date: RATE_DATE, raw: true });

    expect(result.rate).toBeCloseTo(CUSTOM_EUR_TO_BASE, 4);
    expect(result.custom).toBe(true);
  });

  it("never serves one user's custom rate to another user", async () => {
    // The cross-rate cache is keyed by date + pair with no userId, so a custom rate
    // that reached it would be handed to every other user asking for the same pair.
    const CUSTOM_EUR_TO_BASE = 5;
    const baseCode = global.BASE_CURRENCY_CODE;

    await insertRate({ quoteCode: 'EUR', rate: USD_TO_EUR });

    await helpers.addUserCurrencies({ currencyCodes: ['EUR'] });
    await helpers.updateUserCurrency({ currency: { currencyCode: 'EUR', liveRateUpdate: false }, raw: true });
    await helpers.editCurrencyExchangeRate({
      pairs: [
        { baseCode: 'EUR', quoteCode: baseCode, rate: CUSTOM_EUR_TO_BASE },
        { baseCode: baseCode, quoteCode: 'EUR', rate: 1 / CUSTOM_EUR_TO_BASE },
      ],
    });

    const owner = await helpers.getExchangeRatePair({ from: 'EUR', to: baseCode, date: RATE_DATE, raw: true });
    expect(owner.custom).toBe(true);

    const observer = await helpers.signUpSecondUser();
    const result = await helpers.asUser({
      cookies: observer.cookies,
      fn: () => helpers.getExchangeRatePair({ from: 'EUR', to: baseCode, date: RATE_DATE, raw: true }),
    });

    expect(result.rate).toBeCloseTo(USD_TO_AED / USD_TO_EUR, 4);
    expect(result.custom).toBeUndefined();
  });

  it('rejects a non-ISO currency code, a malformed date and an impossible calendar day', async () => {
    const nonIso = await helpers.getExchangeRatePair({ from: 'ZZZ', to: 'USD', date: RATE_DATE });
    expect(nonIso.statusCode).toBe(ERROR_CODES.ValidationError);

    const malformedDate = await helpers.getExchangeRatePair({ from: 'JPY', to: 'USD', date: '15-03-2020' });
    expect(malformedDate.statusCode).toBe(ERROR_CODES.ValidationError);

    const impossibleDate = await helpers.getExchangeRatePair({ from: 'JPY', to: 'USD', date: '2020-13-45' });
    expect(impossibleDate.statusCode).toBe(ERROR_CODES.ValidationError);
  });

  it('answers not-found when the currency has no rate on any date', async () => {
    // A future date short-circuits the provider fetch, so XAF stays unresolvable
    // instead of being healed by a mocked provider response.
    const res = await helpers.getExchangeRatePair({ from: UNPRICED, to: 'USD', date: '2099-01-01' });

    expect(res.statusCode).toBe(ERROR_CODES.NotFoundError);
  });
});
