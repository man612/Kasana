import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import type { RecordId, TransactionModel } from '@bt/shared/types';
import { type InfiniteData, QueryClient } from '@tanstack/vue-query';
import { expect, it } from 'vitest';

import { syncTransactionGroupQueries } from './transaction-groups';

it('updates the cached transaction windows with confirmed membership and restores standalone rows on deletion', async () => {
  const queryClient = new QueryClient();
  const listKey = [...VUE_QUERY_CACHE_KEYS.recordsPageRecordsList, { filter: 'all' }];
  const first = { id: 'first' as RecordId } as TransactionModel;
  const second = { id: 'second' as RecordId } as TransactionModel;
  const third = { id: 'third' as RecordId } as TransactionModel;
  queryClient.setQueryData<InfiniteData<TransactionModel[]>>(listKey, {
    pages: [[first], [second, third]],
    pageParams: [0, 1],
  });
  const group = {
    id: 'confirmed',
    name: 'Groceries',
    icon: 'cart-20-filled',
    note: null,
    createdAt: '2026-11-20',
    updatedAt: '2026-11-20',
    transactions: [first, second],
  };
  await syncTransactionGroupQueries({ queryClient, groupId: group.id, group });
  const grouped = queryClient.getQueryData<InfiniteData<TransactionModel[]>>(listKey);
  expect(grouped?.pages.flat().map((row) => row.transactionGroups)).toEqual([
    [{ id: group.id, name: group.name, icon: group.icon, transactionCount: 2 }],
    [{ id: group.id, name: group.name, icon: group.icon, transactionCount: 2 }],
    undefined,
  ]);
  expect(grouped?.pageParams).toEqual([0, 1]);

  await syncTransactionGroupQueries({ queryClient, groupId: group.id, group: null });
  expect(queryClient.getQueryData<InfiniteData<TransactionModel[]>>(listKey)?.pages.flat()).toEqual([
    { ...first, transactionGroups: [] },
    { ...second, transactionGroups: [] },
    third,
  ]);
  queryClient.clear();
});
