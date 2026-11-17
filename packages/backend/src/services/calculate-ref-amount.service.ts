import { Money } from '@common/types/money';
import { t } from '@i18n/index';
import { ValidationError } from '@js/errors';
import { logger } from '@js/utils/logger';
import * as Currencies from '@models/currencies.model';
import * as UsersCurrencies from '@models/users-currencies.model';
import * as userExchangeRateService from '@services/user-exchange-rate';

import { calculateRefAmountFromParams } from './calculate-ref-amount.utils';
import { withTransaction } from './common/with-transaction';

/**
 * Calculates the reference amount for the provided currencies and parameters.
 * If the quote currency code is not provided, the default user currency is used.
 * If the base currency code is the same as the user's default currency or the quote currency, the original amount is returned.
 *
 * @async
 * @export
 * @param {Object} params
 * @param {number} params.amount - The amount to be converted. Amount represents `baseCode` currency.
 * @param {number} params.userId - The ID of the user for whom the exchange rate is to be fetched.
 * @param {string} params.baseCode - The base currency code.
 * @param {string} [params.quoteCode] - The quote currency code (optional, uses user's default currency if not provided).
 * @returns {Promise<number>} The reference amount after conversion, or the original amount if the base currency is the user's default or the same as the quote currency.
 * @throws {Error} Throws an error if the exchange rate cannot be fetched or the transaction fails.
 * @example
 * const refAmount = await calculateRefAmount({ amount: 100, userId: 42, baseCode: 'USD', quoteCode: 'EUR' });
 * const refAmountForDefaultUserCurrency = await calculateRefAmount({ amount: 100, userId: 42, baseCode: 'USD' });
 */
async function calculateRefAmountImpl(params: Params): Promise<Money> {
  const { baseCode, quoteCode, userId, amount, bypassCache = false } = params;

  try {
    // Resolve the quote currency BEFORE building the cache key: when `quoteCode` is
    // omitted the result depends on the user's CURRENT default currency, so the key
    // must encode that resolved code. A literal "default" placeholder would collide
    // across a base-currency change and re-serve a stale cross-base value.
    let defaultUserCurrency: Currencies.default | undefined = undefined;

    if (!quoteCode) {
      const result = await UsersCurrencies.getCurrency({
        userId,
        isDefaultCurrency: true,
      });

      if (!result) {
        throw new ValidationError({
          message: t({ key: 'currencies.cannotFindForRefAmount' }),
        });
      }
      defaultUserCurrency = result.currency;
    }

    const resolvedQuoteCode = quoteCode ?? defaultUserCurrency?.code;

    if (!baseCode || !resolvedQuoteCode) {
      throw new ValidationError({
        message: t({ key: 'currencies.cannotCalculateRefAmount' }),
        details: { baseCode, defaultUserCurrency },
      });
    }

    // A converted monetary amount depends on mutable per-user custom rates and
    // the latest live-rate preference. Caching only amount/date/currency allows
    // a previous conversion to override a newly committed FX edit for up to 1h.
    // Never read or write converted *amounts* in Redis. getExchangeRate still
    // caches unchanged global market cross-rates for 4h, while consulting the
    // user's connection/custom rate before that cache on each conversion.
    // This also avoids invalidation-vs-concurrent-cache-refill races and
    // failures to invalidate Redis after a committed DB transaction.
    if (resolvedQuoteCode === baseCode) return amount;

    const result = await userExchangeRateService.getExchangeRate({
      userId,
      date: new Date(params.date),
      baseCode,
      quoteCode: resolvedQuoteCode,
      bypassCache,
    });

    return calculateRefAmountFromParams({ amount, rate: result.rate });
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error(e as Error);
    }
    throw e;
  }
}

export { calculateRefAmountFromParams } from './calculate-ref-amount.utils';

type Params = {
  amount: Money;
  userId: number;
  date: Date | string;
  baseCode: string;
  quoteCode?: string;
  /**
   * Bypass the shared four-hour market cross-rate cache in `getExchangeRate`.
   * Cross-currency converted amounts are deliberately not cached. Required for
   * rate-sync and custom-rate remeasurement inside transactions, so they observe
   * uncommitted rate writes without poisoning global cache state.
   */
  bypassCache?: boolean;
};

export const calculateRefAmount = withTransaction(calculateRefAmountImpl);
