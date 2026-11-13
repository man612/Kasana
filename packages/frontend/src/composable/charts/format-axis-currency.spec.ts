import { describe, expect, it } from 'vitest';

import { formatAxisCurrency } from './format-axis-currency';

describe('formatAxisCurrency for Indonesian finances', () => {
  it('uses juta, ribu and miliar rather than ambiguous M for IDR', () => {
    expect(formatAxisCurrency({ value: 2_000_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp 2 jt');
    expect(formatAxisCurrency({ value: 500_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp 500 rb');
    expect(formatAxisCurrency({ value: 2_000_000_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp 2 miliar');
  });
  it('preserves distinct tick values in a near-flat two-million-rupiah chart', () => {
    const f = (value: number) => formatAxisCurrency({ value, symbol: 'Rp', currencyCode: 'IDR', step: 500 });
    expect(f(1_999_000)).not.toBe(f(1_999_500));
    expect(f(1_999_500)).not.toBe(f(2_000_000));
  });
  it('keeps standard units for USD', () => {
    expect(formatAxisCurrency({ value: 1_500_000, symbol: '$', currencyCode: 'USD' })).toBe('$1.5M');
  });
  it('handles smaller values without ambiguous suffixes', () => {
    expect(formatAxisCurrency({ value: 0, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp 0');
    expect(formatAxisCurrency({ value: -250_000, symbol: 'Rp', currencyCode: 'IDR' })).toBe('Rp -250 rb');
  });
});
