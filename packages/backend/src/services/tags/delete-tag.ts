import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import { ValidationError } from '@js/errors';
import Tags from '@models/tags.model';
import { withTransaction } from '@services/common/with-transaction';
import { disableEmptyTrackerRules } from '@services/trackers/rules/disable-empty-tracker-rules';
import { pauseAutomationsReferencing } from '@services/transaction-automations/references';

import { isCoreTag } from './core-tags';

interface DeleteTagPayload {
  id: string;
  userId: number;
}

export const deleteTag = withTransaction(async ({ id, userId }: DeleteTagPayload) => {
  const tag = await findOrThrowNotFound({
    query: Tags.findOne({ where: { id, userId } }),
    message: t({ key: 'tags.tagNotFound' }),
  });

  if (isCoreTag(tag.name)) {
    throw new ValidationError({ message: 'Tag bawaan Keinginan, Kebutuhan, dan Prioritas tidak dapat dihapus.' });
  }

  await pauseAutomationsReferencing({ userId, refType: 'tag', refId: tag.id, label: tag.name });

  await tag.destroy();
  await disableEmptyTrackerRules({ userId });

  return { success: true };
});
