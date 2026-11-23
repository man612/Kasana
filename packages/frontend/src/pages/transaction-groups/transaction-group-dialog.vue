<script setup lang="ts">
import * as transactionGroupsApi from '@/api/transaction-groups';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import TransactionGroupActions from '@/components/transactions-list/transaction-group-actions.vue';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import TransactionsList from '@/components/transactions-list/transactions-list.vue';
import GroupIcon from '@/components/transactions-list/group-icon.vue';
import { syncTransactionGroupQueries, transactionGroupDetailQuery } from '@/composable/data-queries/transaction-groups';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { format, getTime } from 'date-fns';
import { TRANSACTION_TYPES } from '@bt/shared/types';
import { CheckIcon, PencilIcon, XIcon } from '@lucide/vue';
import { useResizeObserver } from '@vueuse/core';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormatCurrency } from '@/composable/formatters';
import { useNotificationCenter } from '@/components/notification-center';
import { extractApiErrorMessage } from '@/js/errors';
import { cn } from '@/lib/utils';

const SUMMARY_CELL =
  'flex items-baseline justify-between gap-3 px-3 py-2 @md/summary:grid @md/summary:justify-start @md/summary:gap-0.5 @md/summary:px-4 @md/summary:py-2.5';
const SUMMARY_LABEL = 'text-muted-foreground text-sm @md/summary:text-xs';
const SUMMARY_VALUE = 'text-sm font-semibold whitespace-nowrap tabular-nums @md/summary:text-lg';

const { t } = useI18n();
const { formatCompactBaseCurrency } = useFormatCurrency();
const { addErrorNotification } = useNotificationCenter();

const props = defineProps<{
  open?: boolean;
  groupId?: string;
  preview?: { name: string; icon?: string | null; iconColor?: string | null };
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  deleted: [];
  updated: [];
}>();

const queryClient = useQueryClient();

const {
  data: group,
  isLoading,
  isError,
  refetch,
} = useQuery(
  computed(() => ({
    ...transactionGroupDetailQuery({ id: props.groupId ?? '' }),
    enabled: Boolean(props.groupId && props.open),
  })),
);

const handleGroupDeleted = () => {
  emit('update:open', false);
  emit('deleted');
};

// Remove transaction from group
const removeConfirm = reactive({
  isOpen: false,
  transactionId: undefined as string | undefined,
});

const wouldDissolve = computed(() => transactions.value.length <= 2);

const handleRemoveTransaction = ({ transactionId }: { transactionId: string }) => {
  removeConfirm.transactionId = transactionId;
  removeConfirm.isOpen = true;
};

const confirmRemoveTransaction = async () => {
  const groupId = props.groupId;
  if (!groupId || !removeConfirm.transactionId) return;

  let result: Awaited<ReturnType<typeof transactionGroupsApi.removeTransactionsFromGroup>>;
  try {
    result = await transactionGroupsApi.removeTransactionsFromGroup({
      groupId,
      transactionIds: [removeConfirm.transactionId],
      force: wouldDissolve.value || undefined,
    });
  } catch (error) {
    addErrorNotification(extractApiErrorMessage(error) || t('transactionGroups.groupDialog.removeError'));
    return;
  } finally {
    removeConfirm.isOpen = false;
  }

  if (result.dissolved) {
    emit('update:open', false);
    emit('deleted');
  }

  await syncTransactionGroupQueries({ queryClient, groupId, group: result.group });
};

const dateBounds = computed(() => {
  if (!group.value?.transactions?.length) return null;
  const times = group.value.transactions.map((tx) => getTime(tx.time));
  return { from: format(Math.min(...times), 'd MMM yyyy'), to: format(Math.max(...times), 'd MMM yyyy') };
});
const isSingleDay = computed(() => dateBounds.value?.from === dateBounds.value?.to);
const dateRange = computed(() => {
  if (!dateBounds.value) return '';
  return isSingleDay.value ? dateBounds.value.from : `${dateBounds.value.from} – ${dateBounds.value.to}`;
});

const isManaging = ref(false);

const noteEl = ref<HTMLElement | null>(null);
const isNoteExpanded = ref(false);
const isNoteClamped = ref(false);
useResizeObserver(noteEl, () => {
  if (noteEl.value && !isNoteExpanded.value)
    isNoteClamped.value = noteEl.value.scrollHeight > noteEl.value.clientHeight;
});

watch(
  () => [props.open, props.groupId],
  () => {
    isManaging.value = false;
    isNoteExpanded.value = false;
  },
);

const transactions = computed(() => group.value?.transactions ?? []);

const metaLine = computed(() =>
  [
    dateRange.value,
    transactions.value.length
      ? `${transactions.value.length} ${t('transactions.transactionGroups.groupsPage.transactionCountLabel')}`
      : '',
  ]
    .filter(Boolean)
    .join(' · '),
);

// Group summary — amounts are aggregated in the user's base currency (refAmount),
// since transactions in the group may live in different currencies.
const summary = computed(() => {
  let income = 0;
  let expense = 0;
  for (const tx of transactions.value) {
    if (tx.transactionType === TRANSACTION_TYPES.income) {
      income += tx.refAmount;
    } else {
      expense += tx.refAmount;
    }
  }
  const hasBothTypes = income > 0 && expense > 0;
  return {
    net: income - expense,
    income,
    expense,
    hasBothTypes,
  };
});
</script>

<template>
  <ResponsiveDialog
    :open="open"
    custom-close
    no-internal-scroll
    sr-only-header
    drawer-custom-indicator
    intrinsic-height-motion
    dialog-content-class="h-[min(40rem,83dvh)] max-w-2xl gap-0 p-0"
    drawer-content-class="h-[min(40rem,85dvh)] gap-0 px-0"
    @update:open="emit('update:open', $event)"
  >
    <template #title>{{ group?.name ?? preview?.name ?? $t('transactionGroups.groupDialog.loadingText') }}</template>
    <template #description>{{ metaLine }}</template>
    <template #default="{ close }">
      <header class="border-border flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <GroupIcon :icon="group ? group.icon : preview?.icon" :color="group ? group.iconColor : preview?.iconColor" />
        <div class="min-w-0 flex-1">
          <h2 class="line-clamp-2 text-base font-semibold wrap-anywhere">
            {{ group?.name ?? preview?.name ?? $t('transactionGroups.groupDialog.loadingText') }}
          </h2>
          <p v-if="metaLine" class="text-muted-foreground text-xs">{{ metaLine }}</p>
        </div>
        <TransactionGroupActions
          v-if="group"
          :group-id="group.id"
          :name="group.name"
          @deleted="handleGroupDeleted"
          @saved="emit('updated')"
        />
        <Button variant="ghost" size="icon" class="size-11 shrink-0" :aria-label="$t('common.ui.close')" @click="close">
          <XIcon class="size-5" />
        </Button>
      </header>
      <div data-vaul-no-drag class="lajur-dialog-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2">
        <div v-if="isLoading" class="space-y-3 py-4">
          <div v-for="i in 3" :key="i" class="bg-muted h-12 animate-pulse rounded" />
        </div>

        <div v-else-if="isError && !group" class="space-y-3 py-4">
          <p class="text-muted-foreground text-sm">{{ $t('transactions.transactionGroups.errors.loadFailed') }}</p>
          <Button variant="outline" size="sm" @click="refetch()">{{ $t('common.actions.retry') }}</Button>
        </div>
        <div v-else-if="group" class="space-y-4 py-2">
          <div v-if="group.note">
            <p
              ref="noteEl"
              :class="cn('text-muted-foreground text-sm wrap-anywhere', !isNoteExpanded && 'line-clamp-2')"
            >
              {{ group.note }}
            </p>
            <Button
              v-if="isNoteClamped || isNoteExpanded"
              variant="link"
              class="h-auto p-0 text-sm"
              :aria-expanded="isNoteExpanded"
              @click="isNoteExpanded = !isNoteExpanded"
            >
              {{
                isNoteExpanded
                  ? $t('transactionGroups.groupDialog.showLessNote')
                  : $t('transactionGroups.groupDialog.showMoreNote')
              }}
            </Button>
          </div>

          <div class="@container/summary">
            <div
              :class="
                cn(
                  'divide-border bg-muted/30 grid divide-y rounded-xl border @md/summary:divide-y-0',
                  summary.hasBothTypes && '@md/summary:grid-cols-3 @md/summary:divide-x',
                )
              "
            >
              <div :class="SUMMARY_CELL">
                <p :class="SUMMARY_LABEL">{{ $t('transactionGroups.groupDialog.summary.net') }}</p>
                <p :class="cn(SUMMARY_VALUE, summary.net >= 0 ? 'text-app-income-color' : 'text-app-expense-color')">
                  {{ formatCompactBaseCurrency({ amount: summary.net }) }}
                </p>
              </div>
              <template v-if="summary.hasBothTypes">
                <div :class="SUMMARY_CELL">
                  <p :class="SUMMARY_LABEL">{{ $t('transactionGroups.groupDialog.summary.moneyIn') }}</p>
                  <p :class="cn(SUMMARY_VALUE, 'text-app-income-color')">
                    {{ formatCompactBaseCurrency({ amount: summary.income }) }}
                  </p>
                </div>
                <div :class="SUMMARY_CELL">
                  <p :class="SUMMARY_LABEL">{{ $t('transactionGroups.groupDialog.summary.moneyOut') }}</p>
                  <p :class="cn(SUMMARY_VALUE, 'text-app-expense-color')">
                    {{ formatCompactBaseCurrency({ amount: summary.expense }) }}
                  </p>
                </div>
              </template>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-sm font-medium">{{ $t('transactionGroups.groupDialog.transactionsLabel') }}</h4>
              <Button variant="outline" size="sm" :aria-pressed="isManaging" @click="isManaging = !isManaging">
                <span class="grid items-center">
                  <Transition name="lajur-info-reveal">
                    <span :key="String(isManaging)" class="col-start-1 row-start-1 flex items-center gap-1.5">
                      <component :is="isManaging ? CheckIcon : PencilIcon" class="size-4" aria-hidden="true" />
                      {{
                        isManaging ? $t('common.actions.done') : $t('transactionGroups.groupDialog.manageTransactions')
                      }}
                    </span>
                  </Transition>
                </span>
              </Button>
            </div>
            <div class="border-border/70 rounded-lg border px-1">
              <TransactionsList
                raw-list
                disable-grouping
                compact
                :hide-date="isSingleDay"
                :paginate="false"
                :transactions="transactions"
              >
                <template #row-trailing="{ tx }">
                  <div
                    class="grid shrink-0 transition-[grid-template-columns,opacity] duration-220 motion-reduce:transition-none"
                    :class="isManaging ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0'"
                    :inert="!isManaging"
                  >
                    <div class="min-w-0 overflow-clip">
                      <DesktopOnlyTooltip :content="$t('transactionGroups.groupDialog.removeFromGroup')">
                        <Button
                          variant="soft-destructive"
                          size="icon-sm"
                          class="mr-1 size-9 shrink-0 sm:size-7"
                          :aria-label="$t('transactionGroups.groupDialog.removeFromGroup')"
                          @click.stop="handleRemoveTransaction({ transactionId: tx.id })"
                        >
                          <XIcon class="size-3.5" />
                        </Button>
                      </DesktopOnlyTooltip>
                    </div>
                  </div>
                </template>
              </TransactionsList>
            </div>
          </div>
        </div>
      </div>
    </template>
  </ResponsiveDialog>

  <!-- Remove transaction confirmation -->
  <ResponsiveAlertDialog
    v-model:open="removeConfirm.isOpen"
    :confirm-label="
      wouldDissolve
        ? $t('transactionGroups.groupDialog.removeAndDeleteButtonText')
        : $t('transactionGroups.groupDialog.removeButtonText')
    "
    confirm-variant="destructive"
    @confirm="confirmRemoveTransaction"
  >
    <template #title>{{ $t('transactionGroups.groupDialog.removeTransactionTitle') }}</template>
    <template #description>
      <template v-if="wouldDissolve">
        {{ $t('transactionGroups.groupDialog.removeTransactionDescription') }}
      </template>
      <template v-else>
        {{ $t('transactionGroups.groupDialog.removeTransactionDescriptionNormal') }}
      </template>
    </template>
  </ResponsiveAlertDialog>
</template>
