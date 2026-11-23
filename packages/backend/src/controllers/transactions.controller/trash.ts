import { TRANSACTION_TRASH_ACTION_MAX } from '@bt/shared/types';
import { uniqueRecordIds } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { deleteTrashed } from '@services/transactions/trash/delete-trashed';
import { getTrash } from '@services/transactions/trash/get-trash';
import { restoreTrashed } from '@services/transactions/trash/restore-trashed';
import { z } from 'zod';

const actionSchema = z.object({
  body: z.object({ transactionIds: uniqueRecordIds({ min: 1, max: TRANSACTION_TRASH_ACTION_MAX }) }),
});

export const getTrashController = createController(z.object({}), async ({ user }) => ({
  data: await getTrash({ userId: user.id }),
}));

const restoreSchema = z.object({
  body: z.union([actionSchema.shape.body, z.strictObject({ all: z.literal(true) })]),
});

export const restoreTrashController = createController(restoreSchema, async ({ user, body }) => ({
  data: await restoreTrashed({ userId: user.id, ...body }),
}));

export const deleteTrashController = createController(actionSchema, async ({ user, body }) => ({
  data: await deleteTrashed({ userId: user.id, transactionIds: body.transactionIds }),
}));
