import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import TransactionGroups from '@models/transaction-groups.model';
import { withTransaction } from '@services/common/with-transaction';

interface DeleteTransactionGroupPayload {
  id: string;
  userId: number;
}

export const deleteTransactionGroup = withTransaction(async ({ id, userId }: DeleteTransactionGroupPayload) => {
  const group = await findOrThrowNotFound({
    query: TransactionGroups.findOne({
      where: { id, userId },
    }),
    message: t({ key: 'transactionGroups.notFound' }),
  });

  // CASCADE on TransactionGroupItems will clean up join rows
  await group.destroy();

  return { success: true };
});
