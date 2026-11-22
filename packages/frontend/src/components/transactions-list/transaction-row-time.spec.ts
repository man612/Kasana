import { describe, expect, it } from 'vitest';

import { formatTransactionRowTime } from './transaction-row-time';

describe('transaction row date and time', () => {
  it('uses the local wall time at a day boundary', () => {
    const local = new Date(2026, 10, 23, 0, 1);
    expect(formatTransactionRowTime({ value: local.toISOString(), showTime: true })).toBe('00:01');
    expect(formatTransactionRowTime({ value: local })).toMatch(/^23 /);
  });

  it('does not invent a time for a date-only record or render invalid dates', () => {
    expect(formatTransactionRowTime({ value: '2026-11-23', showTime: true })).toBe('');
    expect(formatTransactionRowTime({ value: '2026-11-23' })).toMatch(/^23 /);
    expect(formatTransactionRowTime({ value: 'invalid' })).toBe('');
  });

  it('continues to respect an explicit hide-date setting', () => {
    expect(formatTransactionRowTime({ value: new Date(), showTime: true, hideDate: true })).toBe('');
  });
});
