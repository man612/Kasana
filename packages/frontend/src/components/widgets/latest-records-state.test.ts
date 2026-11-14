import { describe, expect, it } from 'vitest';

import { getLatestRecordsState } from './latest-records-state';

type LatestRecordsCase = [
  Parameters<typeof getLatestRecordsState>[0],
  ReturnType<typeof getLatestRecordsState>,
];

const cases: LatestRecordsCase[] = [
    [{ isFetching: true, transactionCount: 0, scheduledCount: 0 }, { isInitialLoading: true, isDataEmpty: false }],
    [{ isFetching: false, transactionCount: 0, scheduledCount: 0 }, { isInitialLoading: false, isDataEmpty: true }],
    [{ isFetching: false, transactionCount: 0, scheduledCount: 1 }, { isInitialLoading: false, isDataEmpty: false }],
    [{ isFetching: false, transactionCount: 1, scheduledCount: 0 }, { isInitialLoading: false, isDataEmpty: false }],
    [{ isFetching: true, transactionCount: 2, scheduledCount: 0 }, { isInitialLoading: false, isDataEmpty: false }],
];

describe('getLatestRecordsState', () => {
  it.each(cases)('handles request and content state %#', (input, expected) => {
    expect(getLatestRecordsState(input)).toEqual(expected);
  });
});
