import { RESOURCE_TYPES, SHARE_PERMISSIONS, isTwoLegTransfer } from '@bt/shared/types';
import { t } from '@i18n/index';
import { NotFoundError } from '@js/errors';
import { findTransactions, type FindTransactionsOptions } from '@models/transactions-query';
import { trashedWhere } from '@models/transactions-query/deletion-where';
import type Transactions from '@models/transactions.model';
import { canUserAccessResource } from '@services/sharing/auth/can-user-access-resource.service';
import { getAccessibleAccountIdsForUser } from '@services/sharing/auth/get-accessible-account-ids.service';
import { assertPlannedWriteAllowed } from '@services/transactions/planned-matching/assert-planned-invariants';
import { Op } from 'sequelize';

type TrashedQuery = Pick<FindTransactionsOptions, 'planned' | 'lock'>;

export const findTrashed = ({ where, ...query }: { where: object } & TrashedQuery) =>
  findTransactions({
    where: { ...where, ...trashedWhere },
    paranoid: false,
    access: 'unscoped-internal',
    balanceAdjustments: 'include',
    completeness: 'all',
    ...query,
  });

/** The trashed transfer twins of these rows that are not among them. */
export const findTrashedTwins = async ({
  rows,
  where = {},
  ...query
}: { rows: Transactions[]; where?: object } & TrashedQuery) => {
  const transferIds = [
    ...new Set(
      rows.filter((row) => isTwoLegTransfer(row.transferNature) && row.transferId).map((row) => row.transferId!),
    ),
  ];
  if (!transferIds.length) return [];

  return findTrashed({
    where: { ...where, transferId: { [Op.in]: transferIds }, id: { [Op.notIn]: rows.map((row) => row.id) } },
    ...query,
  });
};

/** The rows the caller may restore or delete: their creator or the account owner, still holding write access. */
export const filterActionableTrashed = async ({ userId, rows }: { userId: number; rows: Transactions[] }) => {
  const accessByAccount = new Map<string, ReturnType<typeof canUserAccessResource>>();
  const actionable: Transactions[] = [];

  for (const row of rows) {
    if (!accessByAccount.has(row.accountId)) {
      accessByAccount.set(
        row.accountId,
        canUserAccessResource({
          userId,
          resourceType: RESOURCE_TYPES.account,
          resourceId: row.accountId,
          requiredPermission: SHARE_PERMISSIONS.write,
        }),
      );
    }
    const access = await accessByAccount.get(row.accountId)!;
    if (access.granted && (row.userId === userId || access.isOwner)) actionable.push(row);
  }

  return actionable;
};

export const findActionableTrashed = async ({ userId, lock }: { userId: number; lock?: boolean }) => {
  const accountIds = await getAccessibleAccountIdsForUser({ userId });
  if (!accountIds.length) return [];
  return filterActionableTrashed({
    userId,
    rows: await findTrashed({ where: { accountId: { [Op.in]: accountIds } }, planned: { visibleTo: userId }, lock }),
  });
};

/** Lock and authorize the requested entries, then expand the transfer pairs. */
export const loadTrashedLegs = async (
  params: { userId: number } & ({ transactionIds: string[] } | { all: true }),
): Promise<Transactions[]> => {
  const { userId } = params;
  const ids = 'transactionIds' in params ? params.transactionIds : null;
  const rows = ids
    ? await filterActionableTrashed({
        userId,
        rows: await findTrashed({ where: { id: { [Op.in]: ids } }, planned: 'include', lock: true }),
      })
    : await findActionableTrashed({ userId, lock: true });

  if (ids && rows.length !== ids.length) {
    const foundIds = new Set<string>(rows.map((row) => row.id));
    throw new NotFoundError({
      message: t({ key: 'transactions.notFound' }),
      details: { transactionIds: ids.filter((id) => !foundIds.has(id)) },
    });
  }

  for (const row of rows) {
    assertPlannedWriteAllowed({ transaction: row, callerUserId: userId });
  }

  return [...rows, ...(await findTrashedTwins({ rows, planned: 'include', lock: true }))];
};
