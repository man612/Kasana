import { numberFormatLocale } from '@/js/helpers/formatters';
import { afterEach, describe, expect, it } from 'vitest';

import { formatExchangeRateDisplay } from './format-exchange-rate-display';

describe('formatExchangeRateDisplay — IDR reciprocal precision', () => {
  afterEach(() => {
    numberFormatLocale.value = 'id-ID';
  });

  it('shows every significant digit of synthetic IDR to USD instead of rounding to six decimals', () => {
    numberFormatLocale.value = 'id-ID';
    expect(formatExchangeRateDisplay(1 / 16_000)).toBe('0,0000625');
    expect(formatExchangeRateDisplay(1 / 2_500_000)).toBe('0,0000004');
  });

  it('keeps ordinary conversions readable with Indonesian number grouping', () => {
    numberFormatLocale.value = 'id-ID';
    expect(formatExchangeRateDisplay(16_000)).toBe('16.000');
    expect(formatExchangeRateDisplay(0.25)).toBe('0,25');
  });

  it('does not claim that invalid or missing market data is a real rate', () => {
    expect(formatExchangeRateDisplay(Number.NaN)).toBe('—');
    expect(formatExchangeRateDisplay(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
