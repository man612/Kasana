import { describe, expect, it } from 'vitest';

import { formatLoanDuration } from './loan-duration';

describe('formatLoanDuration', () => {
  it.each([
    [6, '6 bulan (0,5 tahun)'],
    [12, '12 bulan (1 tahun)'],
    [18, '18 bulan (1,5 tahun)'],
    [24, '24 bulan (2 tahun)'],
    [27, '27 bulan (2 tahun 3 bulan)'],
    [30, '30 bulan (2,5 tahun)'],
  ])('formats %i months in Indonesian', (months, label) => {
    expect(formatLoanDuration(months, 'id-ID')).toBe(label);
  });
  it('does not invent a duration for an empty or invalid number', () => {
    expect(formatLoanDuration(0)).toBe('');
    expect(formatLoanDuration(Number.NaN)).toBe('');
  });
});
