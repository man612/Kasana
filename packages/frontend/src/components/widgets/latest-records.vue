<script lang="ts" setup>
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { isGroupRow, useTransactionsDisplay } from '@/components/transactions-list/use-transactions-display';
import { createReusableTemplate, useResizeObserver } from '@vueuse/core';
import { type SubscriptionListItem } from '@/api/subscriptions';
import { loadTransactions as apiLoadTransactions } from '@/api/transactions';
import type { DashboardWidgetConfig } from '@/api/user-settings';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { useDateLocale } from '@/composable/use-date-locale';
import { useSubscriptionsList } from '@/composable/data-queries/subscriptions';
import { useFormatCurrency } from '@/composable/formatters';
import { buttonVariants } from '@/components/lib/ui/button';
import UiButton from '@/components/lib/ui/button/Button.vue';
import BrandLogo from '@/components/common/brand-logo.vue';
import { toEntityLogoDisplayProps } from '@/components/common/logo-selection';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import TransactionsList from '@/components/transactions-list/transactions-list.vue';
import SubscriptionMarkPaidDialog from '@/pages/planned/subscriptions/components/subscription-mark-paid-dialog.vue';
import { ROUTES_NAMES } from '@/routes/constants';
import { useCurrenciesStore, useRootStore } from '@/stores';
import { useQuery } from '@tanstack/vue-query';
import { ArrowUpRightIcon, ChevronDownIcon, ListIcon } from '@lucide/vue';
import { differenceInCalendarDays, isAfter, parseISO } from 'date-fns';
import { SUBSCRIPTION_PERIOD_STATUSES, TRANSACTION_TRANSFER_NATURE, TRANSACTION_TYPES } from '@bt/shared/types';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { computed, inject, nextTick, ref, useId, watch } from 'vue';

import EmptyState from './components/empty-state.vue';
import WidgetUnavailable from './components/widget-unavailable.vue';
import LatestRecordsSettingsPopover from './components/latest-records-settings-popover.vue';
import LoadingState from './components/loading-state.vue';
import WidgetWrapper from './components/widget-wrapper.vue';
import {
  buildLatestRecordsTransferNatures,
  readLatestRecordsExclusions,
  readLatestRecordsIncludeScheduled,
  readLatestRecordsTagsVariant,
} from './latest-records-config';
import { useIncludePlannedConfig, useWidgetConfigFlag } from './use-include-planned-config';
import { getLatestRecordsState } from './latest-records-state';

// Days ahead threshold for "upcoming" payments shown in the widget.
const UPCOMING_DAYS_WINDOW = 3;
const MAX_DISPLAY = 20;

const { isAppInitialized } = storeToRefs(useRootStore());
const { formatAmountByCurrencyCode, formatBaseCurrency } = useFormatCurrency();
const widgetConfigRef = inject<Ref<DashboardWidgetConfig> | null>('dashboard-widget-config', null);

const includeScheduled = computed(() => readLatestRecordsIncludeScheduled({ widgetConfig: widgetConfigRef?.value }));
const exclusions = computed(() => readLatestRecordsExclusions({ widgetConfig: widgetConfigRef?.value }));
const transferNatures = computed(() => buildLatestRecordsTransferNatures(exclusions.value));
const excludeBalanceAdjustments = computed(() => exclusions.value.excludeBalanceAdjustments);
const { includePlanned } = useIncludePlannedConfig();
const tagsVariant = computed(() => readLatestRecordsTagsVariant({ widgetConfig: widgetConfigRef?.value }));
const { isOn: showAccount } = useWidgetConfigFlag({
  key: 'showAccount',
  saveErrorKey: 'widgets.latestRecords.settings.showAccountSaveError',
});

const {
  data: transactions,
  isFetching: isTxFetching,
  isError: txError,
  refetch: refetchTx,
} = useQuery({
  queryKey: [...VUE_QUERY_CACHE_KEYS.widgetLatestRecords, transferNatures, excludeBalanceAdjustments, includePlanned],
  queryFn: () =>
    // `to` keeps future-dated plans out of the page, so a backlog of them can't fill it
    // and blank the widget. Over-fetch accounts for deduplication and grouping.
    apiLoadTransactions({
      limit: 40,
      offset: 0,
      transferNatures: transferNatures.value,
      excludeBalanceAdjustments: excludeBalanceAdjustments.value || undefined,
      ...(includePlanned.value ? {} : { isPlanned: false }),
      to: new Date().toISOString(),
    }),
  staleTime: Infinity,
  placeholderData: [],
  enabled: isAppInitialized,
});

// Fetched in parallel with transactions; only active when the toggle is on.
const {
  data: subscriptions,
  isFetching: isScheduledFetching,
  isError: scheduledError,
  refetch: refetchScheduled,
} = useSubscriptionsList({
  filter: { isActive: true },
  enabled: computed(() => isAppInitialized.value && includeScheduled.value),
});

// Subscriptions whose current period is overdue or due within the next UPCOMING_DAYS_WINDOW days.
const scheduledItems = computed<SubscriptionListItem[]>(() => {
  if (!includeScheduled.value || !subscriptions.value) return [];
  const today = new Date();
  return subscriptions.value.filter((sub) => {
    const period = sub.currentPeriod;
    if (!period) return false;
    if (period.status === SUBSCRIPTION_PERIOD_STATUSES.overdue) return true;
    if (period.status === SUBSCRIPTION_PERIOD_STATUSES.upcoming) {
      const daysUntilDue = differenceInCalendarDays(parseISO(period.dueDate), today);
      return daysUntilDue >= 0 && daysUntilDue <= UPCOMING_DAYS_WINDOW;
    }
    return false;
  });
});

// Scheduled items sorted: overdue first, then upcoming ascending by dueDate.
const sortedScheduledItems = computed<SubscriptionListItem[]>(() => {
  return [...scheduledItems.value].sort((a, b) => {
    const aOverdue = a.currentPeriod?.status === SUBSCRIPTION_PERIOD_STATUSES.overdue;
    const bOverdue = b.currentPeriod?.status === SUBSCRIPTION_PERIOD_STATUSES.overdue;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    const aDate = a.currentPeriod?.dueDate ?? '';
    const bDate = b.currentPeriod?.dueDate ?? '';
    return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
  });
});

// Planned rows can carry a future date, which would otherwise put money that hasn't
// moved yet at the top of "latest records".
const pastTransactions = computed(() => {
  const now = new Date();
  return (transactions.value ?? []).filter((tx) => !isAfter(new Date(tx.time), now));
});

// Scheduled rows consume slots first; transactions fill whatever remains up to MAX_DISPLAY.
const scheduledRows = computed(() => sortedScheduledItems.value.slice(0, MAX_DISPLAY));
const txMaxDisplay = computed(() => Math.max(0, MAX_DISPLAY - scheduledRows.value.length));

const { isOn: compact, setFlag: setCompact } = useWidgetConfigFlag({
  key: 'compact',
  saveErrorKey: 'widgets.latestRecords.compactSaveError',
  defaultValue: false,
  optimistic: true,
});
const { displayTransactions } = useTransactionsDisplay({
  transactions: pastTransactions,
  maxDisplay: txMaxDisplay,
});
const { baseCurrency } = storeToRefs(useCurrenciesStore());
const compactCashFlow = computed(() => {
  const code = baseCurrency.value?.currency?.code;
  if (!code || txMaxDisplay.value <= 0) return null;
  const items = displayTransactions.value.flatMap((item) => (isGroupRow(item) ? item.members.slice(0, 3) : [item]));
  const eligible = items.filter(
    (record) =>
      !record.isPlanned &&
      !record.isPending &&
      !record.isBalanceAdjustment &&
      !record.paymentParentId &&
      record.transferNature === TRANSACTION_TRANSFER_NATURE.not_transfer,
  );
  if (!eligible.length) return null;
  let income = 0;
  let expense = 0;
  for (const record of eligible) {
    const amount =
      record.currencyCode === code
        ? (record.paymentTotal ?? record.amount)
        : record.refCurrencyCode === code && record.paymentTotal == null
          ? record.refAmount
          : undefined;
    if (amount === undefined || !Number.isFinite(amount)) return null;
    if (record.transactionType === TRANSACTION_TYPES.income) income += amount;
    else expense += amount;
  }
  return { income, expense };
});
const visibleTransactionRows = computed(() => (txMaxDisplay.value > 0 ? displayTransactions.value.length : 0));
const listId = useId();
const [DefineScheduledRow, UseScheduledRow] = createReusableTemplate<{ sub: SubscriptionListItem }>();

const { format: formatDate } = useDateLocale();
const hasQueryError = computed(() => txError.value || (includeScheduled.value && scheduledError.value));
function retryQueries() {
  if (txError.value) void refetchTx();
  if (includeScheduled.value && scheduledError.value) void refetchScheduled();
}

const listRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const listContent = ref<HTMLElement | null>(null);
const viewport = computed(() => listRef.value?.viewportRef?.viewportElement as HTMLElement | undefined);
const showTopFade = ref(false);
const showBottomFade = ref(false);
let lastScrollTop = 0;
let maxScrollTop = 0;
function onListScroll() {
  const top = viewport.value?.scrollTop ?? 0;
  showTopFade.value = top > 1;
  showBottomFade.value = maxScrollTop - top > 1;
}
function measureScroll() {
  const element = viewport.value;
  if (!element?.clientHeight || compact.value) return;
  maxScrollTop = element.scrollHeight - element.clientHeight;
  onListScroll();
}
useResizeObserver([viewport, listContent], measureScroll);
watch(compact, async (collapsed) => {
  if (collapsed) {
    lastScrollTop = viewport.value?.scrollTop ?? 0;
  } else {
    await nextTick();
    if (viewport.value && !compact.value) viewport.value.scrollTop = lastScrollTop;
    measureScroll();
  }
});

const markPaidDialogRef = ref<InstanceType<typeof SubscriptionMarkPaidDialog> | null>(null);

function handleMarkPaid({ subscription }: { subscription: SubscriptionListItem }) {
  const period = subscription.currentPeriod;
  if (!period) return;
  markPaidDialogRef.value?.triggerPay({
    subscription: {
      id: subscription.id,
      name: subscription.name,
      expectedAmount: subscription.expectedAmount ?? null,
      expectedCurrencyCode: subscription.expectedCurrencyCode ?? null,
      accountId: subscription.accountId ?? null,
    },
    periodId: period.id,
  });
}

function formatDueDate({ dueDate }: { dueDate: string }): string {
  return formatDate(parseISO(dueDate), 'd MMM');
}

const isFetching = computed(() => isTxFetching.value || (includeScheduled.value && isScheduledFetching.value));
// Upcoming/overdue scheduled payments count as content even if there are no
// recorded transactions. Wait until both requests settle before showing empty.
const presentationState = computed(() =>
  getLatestRecordsState({
    isFetching: isFetching.value,
    transactionCount: pastTransactions.value.length,
    scheduledCount: scheduledRows.value.length,
  }),
);
const isInitialLoading = computed(() => presentationState.value.isInitialLoading);
const isDataEmpty = computed(() => presentationState.value.isDataEmpty);

const reportDashboardEmpty = inject<((isEmpty: boolean) => void) | null>('dashboard-widget-empty-change', null);
watch(isDataEmpty, (isEmpty) => reportDashboardEmpty?.(isEmpty), { immediate: true });
</script>

<template>
  <DefineScheduledRow v-slot="{ sub }">
    <div class="bg-muted/40 mb-1.5 flex items-center gap-2.5 rounded-md px-3 py-2">
      <BrandLogo v-bind="toEntityLogoDisplayProps(sub)" :name="sub.name" class="size-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm leading-tight font-medium">
          {{ sub.name }}
        </p>
        <p class="text-muted-foreground overflow-hidden text-xs text-ellipsis whitespace-nowrap">
          <span v-if="sub.currentPeriod?.status === 'overdue'" class="text-app-expense-color font-medium">
            {{ $t('widgets.latestRecords.overdueBadge') }}
          </span>
          <span v-else class="text-warning-text font-medium">
            {{ $t('widgets.latestRecords.scheduledBadge') }}
          </span>
          <span v-if="sub.currentPeriod">
            &nbsp;&middot;&nbsp;{{ formatDueDate({ dueDate: sub.currentPeriod.dueDate }) }}
          </span>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <span class="text-sm font-medium">
          <template v-if="sub.expectedCurrencyCode && sub.expectedAmount != null">
            {{ formatAmountByCurrencyCode(sub.expectedAmount, sub.expectedCurrencyCode) }}
          </template>
          <template v-else-if="sub.expectedAmount != null">
            {{ formatBaseCurrency(sub.expectedAmount) }}
          </template>
        </span>
        <UiButton
          size="sm"
          variant="outline"
          class="h-7 shrink-0 px-2 text-xs"
          @click="handleMarkPaid({ subscription: sub })"
        >
          {{ $t('widgets.latestRecords.payAction') }}
        </UiButton>
      </div>
    </div>
  </DefineScheduledRow>
  <WidgetWrapper class="max-h-[min(65dvh,26rem)]" :is-fetching="isFetching" fit-content>
    <template #title>
      {{ $t('dashboard.widgets.latestTransactions.title') }}
    </template>
    <template #action>
      <DesktopOnlyTooltip
        v-if="!isDataEmpty && !isInitialLoading"
        :content="$t('widgets.latestRecords.goToTransactions')"
      >
        <span class="inline-flex">
          <router-link
            :class="
              buttonVariants({
                variant: 'ghost',
                size: 'icon-sm',
                class: 'text-muted-foreground',
              })
            "
            :to="{ name: ROUTES_NAMES.transactions }"
            :aria-label="$t('widgets.latestRecords.goToTransactions')"
          >
            <ArrowUpRightIcon class="size-4" />
          </router-link>
        </span>
      </DesktopOnlyTooltip>

      <UiButton
        v-if="widgetConfigRef && !isDataEmpty && !isInitialLoading"
        type="button"
        size="sm"
        variant="ghost"
        class="text-muted-foreground min-h-11 shrink-0 px-1"
        :aria-label="$t(compact ? 'widgets.latestRecords.expand' : 'widgets.latestRecords.collapse')"
        :title="$t(compact ? 'widgets.latestRecords.expand' : 'widgets.latestRecords.collapse')"
        :aria-expanded="!compact"
        :aria-controls="listId"
        data-testid="latest-transactions-compact-toggle"
        @click="setCompact({ value: !compact })"
      >
        <span class="grid shrink-0 text-xs">
          <span class="invisible col-start-1 row-start-1" aria-hidden="true">{{
            $t('widgets.latestRecords.details')
          }}</span>
          <Transition name="lajur-form-copy">
            <span :key="String(compact)" class="col-start-1 row-start-1">
              {{ $t(compact ? 'widgets.latestRecords.details' : 'widgets.latestRecords.collapse') }}
            </span>
          </Transition>
        </span>
        <ChevronDownIcon
          class="size-4 motion-safe:transition-transform"
          :class="!compact && 'rotate-180'"
          aria-hidden="true"
        />
      </UiButton>
      <LatestRecordsSettingsPopover />
    </template>

    <template v-if="isInitialLoading">
      <LoadingState class="h-[min(55dvh,22rem)] min-h-0" />
    </template>
    <template v-else-if="isDataEmpty && hasQueryError">
      <WidgetUnavailable @retry="retryQueries" />
    </template>
    <template v-else-if="isDataEmpty">
      <EmptyState>
        <ListIcon class="size-12" />
      </EmptyState>
    </template>
    <template v-else>
      <p v-if="hasQueryError" class="text-warning-text mb-1 text-xs" role="status">
        {{ $t('dashboard.widgets.common.staleData') }}
        <UiButton variant="link" size="sm" @click="retryQueries">{{ $t('common.actions.retry') }}</UiButton>
      </p>
      <LayoutCollapse :open="compact" class="shrink-0">
        <section data-testid="latest-transactions-compact-summary" class="grid gap-2 px-1 pb-1 text-sm">
          <div v-if="compactCashFlow">
            <p class="text-muted-foreground mb-1 text-xs">{{ $t('widgets.latestRecords.cashFlowSample') }}</p>
            <dl class="grid gap-1">
              <div class="flex flex-wrap items-baseline justify-between gap-x-2">
                <dt>{{ $t('dashboard.widgets.expensesStructure.metric.income') }}</dt>
                <dd class="text-app-income-color font-semibold tabular-nums">
                  {{ formatBaseCurrency(compactCashFlow.income) }}
                </dd>
              </div>
              <div class="flex flex-wrap items-baseline justify-between gap-x-2">
                <dt>{{ $t('dashboard.widgets.expensesStructure.metric.expenses') }}</dt>
                <dd class="text-app-expense-color font-semibold tabular-nums">
                  {{ formatBaseCurrency(compactCashFlow.expense) }}
                </dd>
              </div>
            </dl>
          </div>
          <dl v-else class="grid gap-1">
            <div class="flex flex-wrap items-baseline justify-between gap-x-2">
              <dt class="text-muted-foreground">{{ $t('widgets.latestRecords.recordsShown') }}</dt>
              <dd class="font-semibold tabular-nums">{{ visibleTransactionRows }}</dd>
            </div>
            <div v-if="scheduledItems.length" class="flex flex-wrap items-baseline justify-between gap-x-2">
              <dt class="text-muted-foreground">{{ $t('widgets.latestRecords.paymentsDue') }}</dt>
              <dd class="font-semibold tabular-nums">{{ scheduledItems.length }}</dd>
            </div>
          </dl>
        </section>
      </LayoutCollapse>

      <LayoutCollapse :id="listId" :open="!compact" class="min-h-0">
        <div class="relative h-full max-h-[min(55dvh,22rem)] min-h-0">
          <ScrollArea
            ref="listRef"
            class="max-h-[min(55dvh,22rem)] min-h-0"
            viewport-class="max-h-[min(55dvh,22rem)] px-1 md:overscroll-contain-if-scrollable"
            :scroll-y="onListScroll"
          >
            <div ref="listContent">
              <!-- Scheduled payment rows: one row per item, overdue first, sorted by dueDate -->
              <template v-if="includeScheduled && scheduledRows.length > 0">
                <UseScheduledRow v-for="sub in scheduledRows" :key="sub.id" :sub="sub" />
              </template>

              <TransactionsList
                v-if="txMaxDisplay > 0"
                raw-list
                compact
                expand-groups
                :group-preview-limit="3"
                :paginate="false"
                class="gap-0.5!"
                :transactions="pastTransactions"
                :max-display="txMaxDisplay"
                :tags-variant="tagsVariant"
                :show-account="showAccount"
              />
            </div>
          </ScrollArea>
          <div
            :class="!compact && showTopFade ? 'opacity-100' : 'opacity-0'"
            class="from-card pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-linear-to-b to-transparent motion-safe:transition-opacity"
            aria-hidden="true"
            data-testid="latest-transactions-fade-top"
          />
          <div
            :class="!compact && showBottomFade ? 'opacity-100' : 'opacity-0'"
            class="from-card pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-linear-to-t to-transparent motion-safe:transition-opacity"
            aria-hidden="true"
            data-testid="latest-transactions-fade-bottom"
          />
        </div>
      </LayoutCollapse>
    </template>

    <!-- Mark-paid dialog: rendered once, opened imperatively via triggerPay() -->
    <SubscriptionMarkPaidDialog ref="markPaidDialogRef" />
  </WidgetWrapper>
</template>
