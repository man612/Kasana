import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import TransactionGroups from '@models/transaction-groups.model';
import { withTransaction } from '@services/common/with-transaction';

interface UpdateTransactionGroupPayload {
  id: string;
  userId: number;
  name?: string;
  note?: string | null;
  icon?: string | null;
}

export const updateTransactionGroup = withTransaction(async (payload: UpdateTransactionGroupPayload) => {
  const { id, userId, name, note, icon } = payload;

  const group = await findOrThrowNotFound({
    query: TransactionGroups.findOne({
      where: { id, userId },
    }),
    message: t({ key: 'transactionGroups.notFound' }),
  });

  await group.update({
    ...(name !== undefined && { name }),
    ...(note !== undefined && { note }),
    ...(icon !== undefined && { icon }),
  });

  return group;
});
