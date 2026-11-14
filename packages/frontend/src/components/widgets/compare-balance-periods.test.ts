import { describe, expect, it } from 'vitest';
import { compareBalancePeriods } from './compare-balance-periods';

describe('compareBalancePeriods', () => {
  it('reports positive, negative and zero changes', () => {
    expect(compareBalancePeriods({ current: 140, previous: 100 })).toEqual({ absolute: 40, percent: 40 });
    expect(compareBalancePeriods({ current: 0, previous: 100 })).toEqual({ absolute: -100, percent: -100 });
    expect(compareBalancePeriods({ current: 100, previous: 100 })).toEqual({ absolute: 0, percent: 0 });
  });
  it('avoids a fictional percentage when the baseline is zero', () => {
    expect(compareBalancePeriods({ current: 150, previous: 0 })).toEqual({ absolute: 150, percent: null });
  });
  it('distinguishes missing preceding data from a zero balance', () => {
    expect(compareBalancePeriods({ current: 150, previous: null })).toEqual({ absolute: null, percent: null });
  });
  it('uses the magnitude of a negative preceding balance as the denominator', () => {
    expect(compareBalancePeriods({ current: -60, previous: -100 })).toEqual({ absolute: 40, percent: 40 });
  });
});
