import { loadTransactionGroupById, type TransactionGroupResponse } from '@/api/transaction-groups';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import type { RecordId, TransactionModel } from '@bt/shared/types';
import { type InfiniteData, type QueryClient } from '@tanstack/vue-query';

export const transactionGroupDetailQuery = ({ id }: { id: string }) => ({
  queryKey: [...VUE_QUERY_CACHE_KEYS.transactionGroupDetail, id] as const,
  queryFn: () => loadTransactionGroupById({ id }),
  staleTime: 30_000,
});

export function invalidateTransactionGroupQueries({ queryClient }: { queryClient: QueryClient }): void {
  queryClient.invalidateQueries({ queryKey: VUE_QUERY_CACHE_KEYS.transactionGroupDetail });
  queryClient.invalidateQueries({ queryKey: VUE_QUERY_CACHE_KEYS.transactionGroupsList });
  queryClient.invalidateQueries({ queryKey: VUE_QUERY_CACHE_KEYS.recordsPageRecordsList });
  queryClient.invalidateQueries({ queryKey: VUE_QUERY_CACHE_KEYS.widgetLatestRecords });
}

/** Apply the server-confirmed membership to each cached window of records. */
export async function syncTransactionGroupQueries({
  queryClient,
  groupId,
  group,
}: {
  queryClient: QueryClient;
  groupId: string;
  group: TransactionGroupResponse | null;
}) {
  const keys = [
    VUE_QUERY_CACHE_KEYS.recordsPageRecordsList,
    VUE_QUERY_CACHE_KEYS.widgetLatestRecords,
    VUE_QUERY_CACHE_KEYS.transactionGroupsList,
    transactionGroupDetailQuery({ id: groupId }).queryKey,
  ];
  await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));

  const members = group?.transactions ? new Set(group.transactions.map(({ id }) => id)) : undefined;
  const updateRows = (rows: TransactionModel[]) =>
    rows.map((transaction) => {
      const memberships = transaction.transactionGroups ?? [];
      const existing = memberships.find(({ id }) => id === groupId);

      if (!existing && !members?.has(transaction.id)) return transaction;
      const otherGroups = memberships.filter(({ id }) => id !== groupId);
      if (!group || (members && !members.has(transaction.id))) {
        return { ...transaction, transactionGroups: otherGroups };
      }
      return {
        ...transaction,
        transactionGroups: [
          {
            id: groupId as RecordId,
            name: group.name,
            icon: group.icon,
            transactionCount: members?.size ?? existing?.transactionCount ?? 0,
          },
          ...otherGroups,
        ],
      };
    });

  queryClient.setQueriesData<InfiniteData<TransactionModel[]>>(
    { queryKey: VUE_QUERY_CACHE_KEYS.recordsPageRecordsList },
    (data) => data && { ...data, pages: data.pages.map(updateRows) },
  );
  queryClient.setQueriesData<TransactionModel[]>(
    { queryKey: VUE_QUERY_CACHE_KEYS.widgetLatestRecords },
    (data) => data && updateRows(data),
  );
  queryClient.setQueriesData<TransactionGroupResponse[]>(
    { queryKey: VUE_QUERY_CACHE_KEYS.transactionGroupsList },
    (data) =>
      group
        ? data?.map((row) =>
            row.id === groupId
              ? {
                  ...row,
                  name: group.name,
                  note: group.note,
                  icon: group.icon,
                  transactionCount: members?.size ?? row.transactionCount,
                }
              : row,
          )
        : data?.filter(({ id }) => id !== groupId),
  );
  if (group) {
    const { queryKey } = transactionGroupDetailQuery({ id: groupId });
    queryClient.setQueryData<TransactionGroupResponse>(queryKey, (cached) =>
      group.transactions || cached ? { ...cached, ...group } : undefined,
    );
  }
  invalidateTransactionGroupQueries({ queryClient });
}
