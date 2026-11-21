<script setup lang="ts">
import { useNotificationCenter } from '@/components/notification-center';
import { useReorderAutomations, useTransactionAutomations } from '@/composable/data-queries/transaction-automations';
import { isApiErrorWithCode } from '@/js/errors';
import { captureException } from '@/lib/sentry';
import { API_ERROR_CODES, type RecordId, type TransactionAutomationModel } from '@bt/shared/types';
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { VueDraggable } from 'vue-draggable-plus';

import AutomationRow from './automation-row.vue';
import type { AutomationDensity } from './automation-chips';
import { provideAutomationRefs } from './automation-refs';

const props = defineProps<{
  rules: TransactionAutomationModel[];
  density: AutomationDensity;
  reorderable: boolean;
}>();
const emit = defineEmits<{ delete: [rule: TransactionAutomationModel]; apply: [rule: TransactionAutomationModel] }>();

const { t } = useI18n();
const listId = useId();
const { addErrorNotification } = useNotificationCenter();
const { refetch } = useTransactionAutomations();
const reorderMutation = useReorderAutomations();

provideAutomationRefs();

const applyOrder = async ({ ids }: { ids: RecordId[] }) => {
  try {
    await reorderMutation.mutateAsync({ ids });
  } catch (error) {
    // The server rejects an id set that no longer matches its own (another tab reordered
    // or created a rule); a refetch resyncs the list to what the server holds.
    if (isApiErrorWithCode(error, API_ERROR_CODES.conflict)) await refetch();
    else captureException({ error, context: { scope: 'automations:reorder' } });
    addErrorNotification(t('automations.notifications.reorderError'));
  }
};

// VueDraggable mutates its model on drop – emit the new order instead of the prop.
const draggableRules = computed({
  get: () => props.rules,
  set: (next) => applyOrder({ ids: next.map((rule) => rule.id) }),
});
</script>

<template>
  <VueDraggable
    v-model="draggableRules"
    handle=".drag-handle"
    :disabled="!reorderable"
    :animation="200"
    :delay="150"
    :delay-on-touch-only="true"
    ghost-class="automation-row-ghost"
    drag-class="automation-row-dragging"
    :target="`[id='${listId}']`"
    draggable=".lajur-flow-row:not(.lajur-flow-row-leave-active)"
  >
    <TransitionGroup :id="listId" name="lajur-flow-row" tag="div" class="divide-border/60 divide-y">
      <div v-for="(rule, index) in draggableRules" :key="rule.id" class="lajur-flow-row">
        <div>
          <AutomationRow
            :rule="rule"
            :position="reorderable ? index + 1 : undefined"
            :density="density"
            :reorderable="reorderable"
            @delete="emit('delete', rule)"
            @apply="emit('apply', rule)"
          />
        </div>
      </div>
    </TransitionGroup>
  </VueDraggable>
</template>

<style scoped>
/* Sortable's toggleClass accepts a single token, so the preview look lives here, not in Tailwind utilities. */
.automation-row-ghost {
  opacity: 0.4;
}

.automation-row-dragging {
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card-tooltip);
}
</style>
