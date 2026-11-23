import type { RecordId } from '@bt/shared/types';
import { t } from '@i18n/index';
import { ValidationError } from '@js/errors';
import TransactionGroupItems from '@models/transaction-group-items.model';
import TransactionGroups from '@models/transaction-groups.model';
import { withTransaction } from '@services/common/with-transaction';

import { MIN_GROUP_SIZE, MAX_GROUP_SIZE, INCLUDE_GROUP_TRANSACTIONS } from './constants';
import { resolveTransferPairs } from './resolve-transfer-pairs';
import { validateTransactionsForGroup } from './validate-transactions-for-group';

interface CreateTransactionGroupPayload {
  userId: number;
  name: string;
  note?: string | null;
  icon?: string | null;
  iconColor?: string | null;
  transactionIds: RecordId[];
}

export const createTransactionGroup = withTransaction(async (payload: CreateTransactionGroupPayload) => {
  const { userId, name, note, icon, iconColor, transactionIds } = payload;

  // Auto-include opposite sides of transfer pairs
  const expandedIds = await resolveTransferPairs({ transactionIds, userId });

  if (expandedIds.length < MIN_GROUP_SIZE || expandedIds.length > MAX_GROUP_SIZE) {
    throw new ValidationError({
      message: t({ key: 'transactionGroups.size', variables: { min: MIN_GROUP_SIZE, max: MAX_GROUP_SIZE } }),
    });
  }

  await validateTransactionsForGroup({ transactionIds: expandedIds, userId });

  const group = await TransactionGroups.create({
    userId,
    name,
    note: note ?? null,
    icon: icon ?? null,
    iconColor: iconColor ?? null,
  });

  const items = expandedIds.map((transactionId) => ({
    groupId: group.id,
    transactionId,
  }));

  await TransactionGroupItems.bulkCreate(items);

  // Reload with transactions
  const result = await TransactionGroups.findByPk(group.id, {
    include: [INCLUDE_GROUP_TRANSACTIONS],
  });

  return result!;
});
