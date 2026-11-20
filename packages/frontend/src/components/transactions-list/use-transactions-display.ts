import { TransactionModel, dedupeTransferLegs } from '@bt/shared/types';
import { type MaybeRefOrGetter, computed, toValue } from 'vue';

import type { GroupRowData } from './transaction-group-record.vue';

type DisplayItem = TransactionModel | GroupRowData;

export function isGroupRow(item: DisplayItem): item is GroupRowData {
  return 'type' in item && item.type === 'group';
}

export function getDisplayItemKey(item: DisplayItem | undefined, index: number): string | number {
  if (!item) return index;
  if (isGroupRow(item)) return `group-${item.groupId}`;
  return `${item.id}-${item.updatedAt}`;
}

interface UseTransactionsDisplayOptions {
  transactions: MaybeRefOrGetter<TransactionModel[]>;
  contentFiltersActive?: MaybeRefOrGetter<boolean>;
  disableGrouping?: MaybeRefOrGetter<boolean>;
  maxDisplay?: MaybeRefOrGetter<number | undefined>;
}

/**
 * Processes raw transactions for display:
 * - Deduplicates transfers (shows expense side of common transfers when both legs are present;
 *   shows whichever single leg is present when only one side is in the list, e.g. account view)
 * - Groups transactions by groupId into collapsed group rows (unless content filters are active
 *   or grouping is disabled)
 * - Applies optional maxDisplay limit
 */
export function useTransactionsDisplay({
  transactions,
  contentFiltersActive,
  disableGrouping,
  maxDisplay,
}: UseTransactionsDisplayOptions) {
  const displayTransactions = computed<DisplayItem[]>(() => {
    const txs = toValue(transactions);
    const filtersActive = toValue(contentFiltersActive) ?? false;
    const groupingDisabled = toValue(disableGrouping) ?? false;
    const max = toValue(maxDisplay);
    // transfer_to_loan payments share the paired-row invariant of common transfers,
    // so both go through the same dedup.
    const deduplicated = dedupeTransferLegs(txs);

    // Dissolve groups — show individual transactions
    if (filtersActive || groupingDisabled) {
      return max ? deduplicated.slice(0, max) : deduplicated;
    }

    const groupedTransactions = new Map<string, TransactionModel[]>();

    for (const transaction of deduplicated) {
      const membership = transaction.transactionGroups?.[0];
      if (!membership) continue;
      const members = groupedTransactions.get(membership.id);
      if (members) members.push(transaction);
      else groupedTransactions.set(membership.id, [transaction]);
    }

    // Keep the server's current sort order by showing each group at its first member.
    const items: DisplayItem[] = [];
    for (const transaction of deduplicated) {
      const membership = transaction.transactionGroups?.[0];
      if (!membership) {
        items.push(transaction);
        continue;
      }
      const members = groupedTransactions.get(membership.id);
      if (members?.[0] !== transaction) continue;
      const timestamps = members.map((member) => new Date(member.time).getTime());
      items.push({
        type: 'group',
        groupId: membership.id,
        groupName: membership.name,
        icon: membership.icon,
        members,
        transactionCount: membership.transactionCount ?? members.length,
        dateFrom: new Date(Math.min(...timestamps)),
        dateTo: new Date(Math.max(...timestamps)),
      });
    }

    return max ? items.slice(0, max) : items;
  });

  return {
    displayTransactions,
  };
}
