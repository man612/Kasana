import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { t } from '@i18n/index';
import { serializeTransactionGroup } from '@root/serializers/transaction-groups.serializer';
import * as transactionGroupsService from '@services/transaction-groups';
import { z } from 'zod';

const schema = z.object({
  params: z.object({
    id: recordId(),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: () => t({ key: 'transactionGroups.nameRequired' }) })
      .max(100, { error: () => t({ key: 'transactionGroups.nameTooLong' }) })
      .optional(),
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
  }),
});

export default createController(schema, async ({ user, params, body }) => {
  const result = await transactionGroupsService.updateTransactionGroup({
    id: params.id,
    userId: user.id,
    name: body.name,
    icon: body.icon,
    iconColor: body.iconColor,
    note: body.note,
  });

  return { data: serializeTransactionGroup(result) };
});
