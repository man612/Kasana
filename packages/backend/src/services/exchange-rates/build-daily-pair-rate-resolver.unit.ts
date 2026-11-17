import { describe, expect, it } from '@jest/globals';

import { formatRate } from './build-daily-pair-rate-resolver';

describe('formatRate significant precision for low-value currencies', () => {
  it('does not under-value IDR -> USD by 4% in a synthetic 16,000 IDR/USD scenario', () => {
    const reciprocal = 1 / 16_000;
    expect(formatRate(reciprocal)).toBe(0.0000625);
    expect(1_000_000 * formatRate(reciprocal)).toBeCloseTo(62.5, 10);
    // Previous fixed 5-decimal truncation produced 60 USD instead of 62.50.
    expect(Math.trunc(reciprocal * 100_000) / 100_000 * 1_000_000).toBe(60);
  });

  it('does not convert very small valid FX rates to a misleading zero', () => {
    const tiny = 1 / 2_500_000;
    expect(formatRate(tiny)).toBeGreaterThan(0);
    expect(formatRate(tiny)).toBeCloseTo(tiny, 15);
    expect(formatRate(tiny) * 2_500_000).toBeCloseTo(1, 10);
  });

  it('keeps useful precision for an ordinary USD->IDR or non-USD cross rate', () => {
    expect(formatRate(16_000)).toBe(16_000);
    expect(formatRate(0.9 / 3.6)).toBe(0.25);
    expect(formatRate(1 / 3.6)).toBeCloseTo(0.277777777778, 12);
  });

  it('retains zero and non-finite behavior for upstream validation paths', () => {
    expect(formatRate(0)).toBe(0);
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(Number.isNaN(formatRate(Number.NaN))).toBe(true);
  });
});
