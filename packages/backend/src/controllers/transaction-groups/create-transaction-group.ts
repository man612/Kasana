import { uniqueRecordIds } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { t } from '@i18n/index';
import { serializeTransactionGroup } from '@root/serializers/transaction-groups.serializer';
import * as transactionGroupsService from '@services/transaction-groups';
import { z } from 'zod';

const schema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: () => t({ key: 'transactionGroups.nameRequired' }) })
      .max(100, { error: () => t({ key: 'transactionGroups.nameTooLong' }) }),
    note: z
      .string()
      .max(500, { error: () => t({ key: 'transactionGroups.noteTooLong' }) })
      .nullish(),
    icon: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-filled$/, { error: () => t({ key: 'transactionGroups.invalidIcon' }) })
      .nullish(),
    iconColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .toLowerCase()
      .nullish(),
    transactionIds: uniqueRecordIds({ min: 2, max: 50 }),
  }),
});

export default createController(schema, async ({ user, body }) => {
  const result = await transactionGroupsService.createTransactionGroup({
    userId: user.id,
    name: body.name,
    icon: body.icon,
    iconColor: body.iconColor,
    note: body.note ?? null,
    transactionIds: body.transactionIds,
  });

  return { data: serializeTransactionGroup(result) };
});
