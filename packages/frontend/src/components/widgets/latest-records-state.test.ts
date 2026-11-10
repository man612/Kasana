import { describe, expect, it } from 'vitest';

import { getLatestRecordsState } from './latest-records-state';

describe('getLatestRecordsState', () => {
  it.each([
    [{ isFetching: true, transactionCount: 0, scheduledCount: 0 }, { isInitialLoading: true, isDataEmpty: false }],
    [{ isFetching: false, transactionCount: 0, scheduledCount: 0 }, { isInitialLoading: false, isDataEmpty: true }],
    [{ isFetching: false, transactionCount: 0, scheduledCount: 1 }, { isInitialLoading: false, isDataEmpty: false }],
    [{ isFetching: false, transactionCount: 1, scheduledCount: 0 }, { isInitialLoading: false, isDataEmpty: false }],
    [{ isFetching: true, transactionCount: 2, scheduledCount: 0 }, { isInitialLoading: false, isDataEmpty: false }],
  ])('handles request and content state %#', (input, expected) => {
    expect(getLatestRecordsState(input)).toEqual(expected);
  });
});
