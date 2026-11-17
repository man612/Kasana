import { connection } from '@models/connection';
import { buildUsdRateLookup } from '@services/stats/build-usd-rate-lookup';
import { createFindLatestUsdRate } from '@services/stats/get-combined-balance-history/exchange-rate-lookup';
import { QueryTypes, Transaction as SequelizeTransaction } from 'sequelize';

import { API_LAYER_BASE_CURRENCY_CODE } from './constants';

export const MS_PER_DAY = 86_400_000;

/**
 * Keep 12 SIGNIFICANT digits for currency pairs, including tiny reciprocal
 * rates such as IDR -> USD. Truncating to 5 fixed decimal PLACES silently
 * changes 1/16000 (0.0000625) to 0.00006 (-4%), and can round small
 * currencies all the way to zero. Preserve non-finite behavior; upstream
 * validation still rejects non-positive/invalid provider rates.
 *
 * This shared formatter is used by both getExchangeRate and daily balance
 * revaluation so the two paths agree without a schema/data migration.
 */
export const formatRate = (rate: number): number =>
  Number.isFinite(rate) ? Number(rate.toPrecision(12)) : rate;

/** UTC calendar day of a timestamp, or the day part of a `DATEONLY` string. */
export const toDayKey = (date: Date | string): string =>
  typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);

export type DailyPairRateResolver = (dayKey: string) => number | null;

/**
 * Per-day `baseCode → quoteCode` rate from the USD-pivot rows: exact day, else the
 * most recent earlier day, else the earliest day known for that currency.
 *
 * Returns `null` when either leg has no stored rate dated on or before `to`. The
 * resolver returns `null` only when a currency pair has no usable positive rate.
 */
export const buildDailyPairRateResolver = async ({
  baseCode,
  quoteCode,
  from,
  to,
  transaction,
}: {
  baseCode: string;
  quoteCode: string;
  from: Date;
  to: Date;
  transaction?: SequelizeTransaction;
}): Promise<DailyPairRateResolver | null> => {
  const quoteCodes = [baseCode, quoteCode];

  const systemRates = (await connection.sequelize.query(
    `SELECT "quoteCode", "date", "rate"
       FROM "ExchangeRates"
      WHERE "baseCode" = :pivotCode AND "quoteCode" IN (:quoteCodes) AND "date" >= :from AND "date" < :toExclusive
      ORDER BY "quoteCode", "date" ASC`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        pivotCode: API_LAYER_BASE_CURRENCY_CODE,
        quoteCodes,
        from,
        toExclusive: new Date(+to + MS_PER_DAY),
      },
      transaction,
    },
  )) as { quoteCode: string; date: Date; rate: number }[];

  const { usdRatesMap, usdRateDatesByQuote } = await buildUsdRateLookup({
    systemRates,
    quoteCodes,
    windowStart: toDayKey(from),
  });
  const findLatestUsdRate = createFindLatestUsdRate({ usdRatesMap, usdRateDatesByQuote });

  // A leg whose only rate is dated after the window counts as uncovered, so callers
  // resolve each row's own date instead of writing one borrowed rate to every row.
  const lastDayKey = toDayKey(to);
  const hasRateInRange = (code: string) => {
    if (code === API_LAYER_BASE_CURRENCY_CODE) return true;
    const earliest = usdRateDatesByQuote.get(code)?.[0];
    return earliest !== undefined && earliest <= lastDayKey;
  };

  if (!hasRateInRange(baseCode) || !hasRateInRange(quoteCode)) return null;

  return (dayKey: string) => {
    const usdToBase = findLatestUsdRate(baseCode, dayKey);
    const usdToQuote = findLatestUsdRate(quoteCode, dayKey);
    if (!usdToBase || !usdToQuote || usdToBase.rate === 0) return null;

    // Precision-sensitive pairs remain nonzero even when their value is less
    // than 0.00001, so native holdings are never silently zero-valued.
    const rate = formatRate(usdToQuote.rate / usdToBase.rate);
    return rate > 0 ? rate : null;
  };
};
