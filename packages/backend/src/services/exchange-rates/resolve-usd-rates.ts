import { logger } from '@js/utils';
import ExchangeRates from '@models/exchange-rates.model';
import { endOfDay, isAfter, startOfDay } from 'date-fns';
import { Op } from 'sequelize';

import { API_LAYER_BASE_CURRENCY_CODE } from './constants';
import { fetchAndStoreRatesForDate, isDateComprehensivelyFetched } from './ensure-rates-for-date';

/**
 * Result of resolving a single USD-base rate for a date.
 *  - `exact`:    an exact-date row exists.
 *  - `fallback`: no exact-date row; use the latest rate strictly BEFORE the
 *                requested date, else the earliest rate AFTER that date.
 *                The chosen date is preserved to signal an approximation.
 *  - `missing`:  no rate at all, on any date.
 *
 * The fallback case is a distinct `kind` (rather than a row silently returned as
 * if exact) so callers can't confuse "the real rate for this date" with "a stale
 * substitute". That distinction drives both the fetch decision here and the
 * caller's cross-rate / cache choices.
 */
export type RateLookup =
  | { kind: 'exact'; rate: number; date: Date }
  | { kind: 'fallback'; rate: number; rateDate: Date; requestedDate: Date }
  | { kind: 'missing' };

/**
 * Resolve the USD-base rate for each of `codes` on `date`, hitting providers at
 * most once if needed.
 *
 * This is the single owner of the "what rate do I have, and is it worth
 * fetching?" decision. It:
 *   1. reads what's already stored (exact / fallback / missing per code),
 *   2. if any code is non-exact AND the comprehensive provider (ApiLayer) hasn't
 *      already run for the date, fetches the whole basket once and re-reads,
 *   3. returns the resolved lookup per code.
 *
 * Callers never re-query the DB to learn what happened – the returned map IS the
 * answer. `USD` always resolves to an exact rate of 1 and is never fetched.
 */
export async function resolveUsdRates({
  codes,
  date,
}: {
  codes: string[];
  date: Date;
}): Promise<Map<string, RateLookup>> {
  const wanted = [...new Set(codes.map((code) => code.toUpperCase()))];

  const lookups = new Map<string, RateLookup>();
  for (const code of wanted) {
    lookups.set(code, await loadRate(code, date));
  }

  // All exact → nothing to fetch. (This is the coverage check – it lives here
  // only, instead of being re-derived by both the caller and the fetcher.)
  if ([...lookups.values()].every((lookup) => lookup.kind === 'exact')) {
    return lookups;
  }

  // A leg is non-exact. The comprehensiveness gate decides whether a fetch can
  // even help: if ApiLayer already ran for this date, a still-missing currency
  // is authoritatively unavailable and re-fetching is futile.
  if (await isDateComprehensivelyFetched(startOfDay(date))) {
    return lookups;
  }

  // No provider has rates for a day that hasn't happened yet – fetching a future
  // date 404s/400s upstream and throws. Skip the fetch and return what's already
  // loaded: a currency with any stored history resolves to its `fallback`
  // (priceable), a never-priced one stays `missing` (the caller handles that).
  // The day boundary is start-of-day vs. start-of-day, so any time later today
  // is NOT future.
  if (isAfter(startOfDay(date), startOfDay(new Date()))) {
    return lookups;
  }

  try {
    await fetchAndStoreRatesForDate(date);
  } catch (error) {
    // Fetch failed. If every requested code still has at least a fallback, the
    // failure is non-fatal – return the approximations. If any code has no rate
    // at all, there is nothing to fall back to, so surface the error.
    const anyMissing = [...lookups.values()].some((lookup) => lookup.kind === 'missing');
    if (anyMissing) {
      throw error;
    }
    logger.warn(`[resolveUsdRates] Failed to fetch rates for ${date.toISOString()}, using fallback rates`);
    return lookups;
  }

  // Re-read only the legs that weren't already exact.
  for (const code of wanted) {
    if (lookups.get(code)!.kind !== 'exact') {
      lookups.set(code, await loadRate(code, date));
    }
  }

  return lookups;
}

/**
 * Read the USD-base rate for one currency on one date: prefer exact,
 * then the latest rate BEFORE the requested day, then (only when history
 * starts later) the earliest rate AFTER that day. Never use the newest
 * future rate to price an old transaction. Dates on fallback are explicit.
 * Missing means the currency has no stored rate on any date.
 */
async function loadRate(code: string, rateDate: Date): Promise<RateLookup> {
  if (code === API_LAYER_BASE_CURRENCY_CODE) {
    // The base currency converts to itself at 1 – always exact, never fetched.
    return { kind: 'exact', rate: 1, date: rateDate };
  }

  const exact = await ExchangeRates.findOne({
    where: {
      date: { [Op.between]: [startOfDay(rateDate), endOfDay(rateDate)] },
      baseCode: API_LAYER_BASE_CURRENCY_CODE,
      quoteCode: code,
    },
    raw: true,
  });

  if (exact) {
    return { kind: 'exact', rate: exact.rate, date: exact.date };
  }

  // Prefer an as-of quote: last available publication strictly before
  // this calendar day. The previous unbounded DESC query could select a much
  // newer market rate when valuing historical transactions or balances.
  const prior = await ExchangeRates.findOne({
    where: {
      baseCode: API_LAYER_BASE_CURRENCY_CODE,
      quoteCode: code,
      date: { [Op.lt]: startOfDay(rateDate) },
    },
    order: [['date', 'DESC']],
    raw: true,
  });

  // Historical bootstrap fallback: if a requested day predates ALL stored
  // quotes, use the earliest published quote (not the newest). This mirrors
  // the daily balance resolver's existing pre-coverage behavior.
  const fallback =
    prior ??
    (await ExchangeRates.findOne({
      where: {
        baseCode: API_LAYER_BASE_CURRENCY_CODE,
        quoteCode: code,
        date: { [Op.gt]: endOfDay(rateDate) },
      },
      order: [['date', 'ASC']],
      raw: true,
    }));

  if (fallback) {
    logger.info(
      `[loadRate] Using fallback rate for ${code} from ${fallback.date} (requested ${rateDate.toISOString()})`,
    );
    return { kind: 'fallback', rate: fallback.rate, rateDate: fallback.date, requestedDate: rateDate };
  }

  return { kind: 'missing' };
}
