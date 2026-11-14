import { describe, expect, it } from 'vitest';

import { formatAxisCurrency } from './format-axis-currency';

describe('formatAxisCurrency for Indonesian finances', () => {
  it('uses juta, ribu and miliar rather than ambiguous M for IDR', () => {
    expect(formatAxisCurrency({ value: 2_000_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp2 jt');
    expect(formatAxisCurrency({ value: 500_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp500 rb');
    expect(formatAxisCurrency({ value: 2_000_000_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp2 miliar');
  });

  it('preserves distinct tick values in a near-flat two-million-rupiah chart', () => {
    const f = (value: number) => formatAxisCurrency({ value, symbol: 'Rp', currencyCode: 'IDR', step: 500 });
    expect(f(1_999_000)).toBe('Rp1.999.000');
    expect(f(1_999_000)).not.toBe(f(1_999_500));
    expect(f(1_999_500)).not.toBe(f(2_000_000));
  });

  it('promotes rounded values at unit boundaries instead of showing 1.000 of the lower unit', () => {
    expect(formatAxisCurrency({ value: 999_999, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp1 jt');
    expect(formatAxisCurrency({ value: 999_999_999, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp1 miliar');
    expect(formatAxisCurrency({ value: 999_999_999_999, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp1 triliun');
  });

  it('uses full rupiah labels when a small chart step would collapse after unit promotion', () => {
    expect(formatAxisCurrency({ value: 999_999, symbol: 'Rp', currencyCode: 'IDR', step: 500 })).toBe('Rp999.999');
  });

  it('places a negative sign before the currency symbol consistently', () => {
    expect(formatAxisCurrency({ value: -250_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('-Rp250 rb');
    expect(formatAxisCurrency({ value: -1_500_000, symbol: '$', currencyCode: 'USD' })).toBe('-$1.5M');
  });

  it('keeps standard units for USD', () => {
    expect(formatAxisCurrency({ value: 1_500_000, symbol: '$', currencyCode: 'USD' })).toBe('$1.5M');
  });

  it('uses at most one digit after comma for IDR labels', () => {
    expect(formatAxisCurrency({ value: 2_040_000, symbol: 'Rp', currencyCode: 'IDR', step: 200_000 })).toBe('Rp2 jt');
    expect(formatAxisCurrency({ value: 2_060_000, symbol: 'Rp', currencyCode: 'IDR', step: 200_000 })).toBe('Rp2,1 jt');
  });

  it('handles smaller values without ambiguous suffixes', () => {
    expect(formatAxisCurrency({ value: 0, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp0');
    expect(formatAxisCurrency({ value: -250_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('-Rp250 rb');
  });
});
