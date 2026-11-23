<script setup lang="ts">
import { bulkScanTransferRecommendations, dismissTransferSuggestion, linkTransactions } from '@/api/transactions';
import { ROUTES_NAMES } from '@/routes/constants';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { Card } from '@/components/lib/ui/card';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { useAiSettings } from '@/composable/data-queries/ai-settings';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { SCROLL_AREA_IDS } from '@/components/lib/ui/scroll-area/types';
import { useScrollAreaContainer } from '@/composable/scroll-area-container';
import { useNotificationCenter } from '@/components/notification-center';
import TransactionDetailsModal from '@/components/transactions-list/transaction-details-modal.vue';
import { useManageTransactionDialog } from '@/components/transactions-list/use-manage-transaction-dialog';
import { cn } from '@/lib/utils';
import { VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const/vue-query';
import { useWindowBreakpoints } from '@/composable/window-breakpoints';
import { useVirtualizedInfiniteScroll } from '@/composable/virtualized-infinite-scroll';
import { AI_FEATURE, type TransactionModel, type RecordId, type BulkTransferScanItem } from '@bt/shared/types';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { Period } from '@/composable/use-period-navigation';
import { endOfDay, endOfMonth, isValid, parseISO, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { useRoute } from 'vue-router';
import { ArrowLeftIcon, SearchXIcon, SparklesIcon } from '@lucide/vue';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocalStorage, useResizeObserver } from '@vueuse/core';
import OptimizationHelp from '../components/optimization-help.vue';

import ExpenseListItem from './components/expense-list-item.vue';
import ScanControls from './components/scan-controls.vue';
import SuggestionsPanel from './components/suggestions-panel.vue';
import DialogHeader from '@/components/lib/ui/dialog/DialogHeader.vue';

const { t, locale } = useI18n();
const formatScanDate = (date: string) =>
  new Date(date).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const queryClient = useQueryClient();
const SINGLE_PANEL_BREAKPOINT = 1023;
const isSinglePanel = useWindowBreakpoints(SINGLE_PANEL_BREAKPOINT);

const ManageTransactionDialogContent = defineAsyncComponent(
  () => import('@/components/dialogs/manage-transaction/dialog-content.vue'),
);

const PAGE_SIZE = 20;

const route = useRoute();
const queryFrom = parseISO(String(route.query.from));
const queryTo = parseISO(String(route.query.to));
const hasQueryPeriod = isValid(queryFrom) && isValid(queryTo);

const period = ref<Period>(
  hasQueryPeriod
    ? { from: startOfDay(queryFrom), to: endOfDay(queryTo) }
    : { from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) },
);
const includeOutOfWallet = ref(false);
const aiReview = useLocalStorage('optimizations:transfers:ai-review', false);
const getScanFilters = () => ({
  from: period.value.from.toISOString(),
  to: period.value.to.toISOString(),
  includeOutOfWallet: includeOutOfWallet.value,
  aiReview: aiReview.value,
});
const appliedFilters = ref<ReturnType<typeof getScanFilters>>();
const lastScanUsedAi = computed(() => Boolean(appliedFilters.value?.aiReview));
const hasScanned = computed(() => appliedFilters.value !== undefined);
const isScanning = ref(false);
const resultsNeedRefresh = ref(false);
let scanGeneration = 0;

// Accumulated scan results across pages
const allItems = ref<BulkTransferScanItem[]>([]);
const totalCount = ref(0);
const currentOffset = ref(0);
const isFetchingPage = ref(false);
const pageLoadFailed = ref(false);

const selectedItemIndex = ref<number>(0);
const suggestionsDialogOpen = ref(false);

const selectedItem = computed<BulkTransferScanItem | null>(() => {
  if (allItems.value.length === 0) return null;
  return allItems.value[selectedItemIndex.value] ?? null;
});

const hasNextPage = computed(() => !lastScanUsedAi.value && currentOffset.value < totalCount.value);

// Manage transaction dialog
const { isDialogVisible, editSession, dialogProps, isCompactDialog, handleRecordClick, closeDialog } =
  useManageTransactionDialog();

// Desktop scrolls the list inside its panel; single-panel scrolls the whole page.
const leftScrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const pageScrollContainer = useScrollAreaContainer(SCROLL_AREA_IDS.dashboard);
const leftPanelScrollElement = computed<HTMLElement | null>(() =>
  isSinglePanel.value
    ? (pageScrollContainer.value?.viewportElement ?? null)
    : ((leftScrollAreaRef.value?.viewportRef as { viewportElement?: HTMLElement } | null)?.viewportElement ?? null),
);
const pageRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const scrollMargin = ref(0);
const measureScrollMargin = () => {
  const el = listRef.value;
  const scrollEl = leftPanelScrollElement.value;
  scrollMargin.value =
    isSinglePanel.value && el && scrollEl
      ? el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop
      : 0;
};
watch([listRef, isSinglePanel], measureScrollMargin);
useResizeObserver(pageRef, measureScrollMargin);

const { virtualRows, totalSize } = useVirtualizedInfiniteScroll<BulkTransferScanItem>({
  items: allItems,
  hasNextPage,
  fetchNextPage: loadNextPage,
  isFetchingNextPage: isFetchingPage,
  parentRef: leftPanelScrollElement,
  scrollMargin,
  estimateSize: () => 52,
  overscan: 10,
  getItemKey: (index) => allItems.value[index]?.expense.id ?? index,
});

async function loadNextPage() {
  const filters = appliedFilters.value;
  if (
    !filters ||
    !hasNextPage.value ||
    pageLoadFailed.value ||
    resultsNeedRefresh.value ||
    isFetchingPage.value ||
    isScanning.value ||
    isActing.value
  )
    return;
  const generation = scanGeneration;
  isFetchingPage.value = true;

  try {
    const data = await bulkScanTransferRecommendations({
      ...filters,
      offset: currentOffset.value,
      limit: PAGE_SIZE,
    });

    if (generation !== scanGeneration) return;
    const existing = new Set(allItems.value.map(({ expense }) => expense.id));
    allItems.value = [...allItems.value, ...data.items.filter(({ expense }) => !existing.has(expense.id))];
    totalCount.value = data.total;
    currentOffset.value += data.items.length;
    if (!data.items.length) currentOffset.value = data.total;
  } catch {
    if (generation === scanGeneration) pageLoadFailed.value = true;
  } finally {
    isFetchingPage.value = false;
  }
}

function retryNextPage() {
  pageLoadFailed.value = false;
  void loadNextPage();
}

const WEAK_CONFIDENCE = 70;
const { getFeatureStatus } = useAiSettings();
const showAiRescanHint = computed(() => {
  if (!allItems.value.length || lastScanUsedAi.value || !getFeatureStatus(AI_FEATURE.transferMatching)?.servedBy)
    return false;
  const weak = allItems.value.filter((item) => item.matches.every((m) => m.confidence < WEAK_CONFIDENCE)).length;
  return weak >= allItems.value.length / 4;
});

function rescanWithAi() {
  if (isScanning.value || isActing.value) return;
  aiReview.value = true;
  scanFromScratch();
}

function scanFromScratch() {
  if (isActing.value) return;
  void freshScan(getScanFilters());
}

async function freshScan(filters: ReturnType<typeof getScanFilters>) {
  if (isScanning.value) return;
  const generation = ++scanGeneration;
  isScanning.value = true;

  try {
    const data = await bulkScanTransferRecommendations({ ...filters, offset: 0, limit: PAGE_SIZE });

    if (generation !== scanGeneration) return;
    appliedFilters.value = filters;
    allItems.value = data.items;
    totalCount.value = data.total;
    currentOffset.value = data.items.length;
    pageLoadFailed.value = false;
    resultsNeedRefresh.value = false;
    selectedItemIndex.value = 0;
  } catch {
    if (generation === scanGeneration)
      addErrorNotification(t('optimizations.transferSuggestions.notifications.scanError'));
  } finally {
    isScanning.value = false;
  }
}

// Link mutation
const linkMutation = useMutation({
  mutationFn: ({ expenseId, incomeId }: { expenseId: string; incomeId: string }) =>
    linkTransactions({ ids: [[expenseId as RecordId, incomeId as RecordId]] }),
  onMutate: async ({ expenseId, incomeId }) => {
    const previous = {
      items: allItems.value,
      total: totalCount.value,
      offset: currentOffset.value,
      selected: selectedItemIndex.value,
    };

    allItems.value = allItems.value
      .filter((item) => item.expense.id !== expenseId)
      .map((item) => ({
        ...item,
        matches: item.matches.filter((m) => m.transaction.id !== incomeId),
      }))
      .filter((item) => item.matches.length > 0);
    const removed = previous.items.length - allItems.value.length;
    totalCount.value = Math.max(0, totalCount.value - removed);
    currentOffset.value = Math.max(0, currentOffset.value - removed);

    if (selectedItemIndex.value >= allItems.value.length) {
      selectedItemIndex.value = Math.max(0, allItems.value.length - 1);
    }

    suggestionsDialogOpen.value = false;

    return { previous };
  },
  onSuccess: () => {
    addSuccessNotification(t('optimizations.transferSuggestions.notifications.linkSuccess'));

    const filters = appliedFilters.value;
    if (filters && !filters.aiReview) void freshScan(filters);
    void queryClient.invalidateQueries({ queryKey: [VUE_QUERY_GLOBAL_PREFIXES.transactionChange] });
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      allItems.value = context.previous.items;
      totalCount.value = context.previous.total;
      currentOffset.value = context.previous.offset;
      selectedItemIndex.value = context.previous.selected;
    }
    addErrorNotification(t('optimizations.transferSuggestions.notifications.linkError'));
  },
});

// Skip (dismiss) mutation
const skipMutation = useMutation({
  mutationFn: ({ expenseId, incomeId }: { expenseId: string; incomeId: string }) =>
    dismissTransferSuggestion({
      expenseTransactionId: expenseId as RecordId,
      incomeTransactionId: incomeId as RecordId,
    }),
  onMutate: async ({ expenseId, incomeId }) => {
    const previous = {
      items: allItems.value,
      total: totalCount.value,
      offset: currentOffset.value,
      selected: selectedItemIndex.value,
    };

    // Optimistic: remove the skipped match from the expense's matches
    allItems.value = allItems.value
      .map((item) => {
        if (item.expense.id !== expenseId) return item;
        return {
          ...item,
          matches: item.matches.filter((m) => m.transaction.id !== incomeId),
        };
      })
      .filter((item) => item.matches.length > 0);

    // If expense lost all matches, decrement total
    if (allItems.value.length < previous.items.length) {
      totalCount.value = Math.max(0, totalCount.value - 1);
      currentOffset.value = Math.max(0, currentOffset.value - 1);
    }

    if (selectedItemIndex.value >= allItems.value.length) {
      selectedItemIndex.value = Math.max(0, allItems.value.length - 1);
    }

    return { previous };
  },
  onSuccess: () => {
    addSuccessNotification(t('optimizations.transferSuggestions.notifications.skipSuccess'));
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      allItems.value = context.previous.items;
      totalCount.value = context.previous.total;
      currentOffset.value = context.previous.offset;
      selectedItemIndex.value = context.previous.selected;
    }
    addErrorNotification(t('optimizations.transferSuggestions.notifications.skipError'));
  },
});

const isActing = computed(() => linkMutation.isPending.value || skipMutation.isPending.value);
const actionsDisabled = computed(() => isScanning.value || isFetchingPage.value || resultsNeedRefresh.value);

if (hasQueryPeriod) scanFromScratch();

function handleSelectExpense(index: number) {
  selectedItemIndex.value = index;
  if (isSinglePanel.value) {
    suggestionsDialogOpen.value = true;
  }
}

function handleLink(payload: { expenseId: string; incomeId: string }) {
  if (isActing.value || actionsDisabled.value) return;
  linkMutation.mutate(payload);
}

function handleSkip(payload: { expenseId: string; incomeId: string }) {
  if (isActing.value || actionsDisabled.value) return;
  skipMutation.mutate(payload);
}

function refreshAfterTransactionCommit() {
  const filters = appliedFilters.value;
  if (!filters) return;

  scanGeneration += 1;
  resultsNeedRefresh.value = true;
  suggestionsDialogOpen.value = false;
  if (!filters.aiReview) void freshScan(filters);
}

function handleTransactionClick(tx: TransactionModel, oppositeTx: TransactionModel | undefined) {
  handleRecordClick([tx, oppositeTx]);
}
</script>

<template>
  <div
    ref="pageRef"
    :class="
      cn(
        'flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6',
        !isSinglePanel && 'h-[calc(100dvh-var(--header-height))] overflow-hidden',
      )
    "
  >
    <header class="flex shrink-0 items-start gap-2">
      <Button variant="ghost" size="icon-sm" class="text-muted-foreground -ml-1 shrink-0" as-child>
        <RouterLink :to="{ name: ROUTES_NAMES.optimizations }" :aria-label="$t('optimizations.backToOptimizations')">
          <ArrowLeftIcon class="size-4" />
        </RouterLink>
      </Button>
      <div class="grid min-w-0 flex-1 gap-1">
        <h1 class="text-lg font-semibold tracking-tight">
          {{ $t('optimizations.cards.transfers.title') }}
        </h1>
        <p class="text-muted-foreground text-sm">{{ $t('optimizations.transferSuggestions.description') }}</p>
      </div>
      <OptimizationHelp feature="transfers" />
    </header>

    <!-- Main container — always rendered, holds either content or empty/initial/loading states -->
    <Card class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScanControls
        v-model:period="period"
        v-model:include-out-of-wallet="includeOutOfWallet"
        v-model:ai-review="aiReview"
        :is-loading="isScanning || isActing"
        class="shrink-0"
        @scan="scanFromScratch"
      />

      <p v-if="appliedFilters" class="text-muted-foreground border-b px-4 py-2 text-xs">
        {{
          $t('optimizations.transferSuggestions.appliedPeriod', {
            from: formatScanDate(appliedFilters.from),
            to: formatScanDate(appliedFilters.to),
          })
        }}
      </p>

      <p v-if="resultsNeedRefresh && !isScanning" class="text-warning-text border-b px-4 py-2 text-xs" role="status">
        {{ $t('optimizations.transferSuggestions.resultsNeedRefresh') }}
      </p>

      <div v-if="pageLoadFailed" class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <p class="text-warning-text text-xs" role="status">
          {{ $t('optimizations.transferSuggestions.notifications.loadError') }}
        </p>
        <Button variant="outline" size="sm" class="min-h-11" @click="retryNextPage">
          {{ $t('common.actions.retry') }}
        </Button>
      </div>

      <div
        v-if="hasScanned && totalCount > 0"
        class="text-muted-foreground flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-sm"
      >
        <span>
          <span class="text-foreground font-semibold">{{ totalCount }}</span>
          {{ $t('optimizations.transferSuggestions.potentialTransfersFound') }}
        </span>
        <DesktopOnlyTooltip
          v-if="showAiRescanHint && isSinglePanel"
          :content="$t('optimizations.transferSuggestions.aiReview.rescanHintTooltip')"
          content-class-name="max-w-xs"
        >
          <Button variant="ghost-primary" size="sm" class="-my-1 h-7 gap-1.5" @click="rescanWithAi">
            <SparklesIcon class="size-3.5" />
            {{ $t('optimizations.transferSuggestions.aiReview.rescanHint') }}
          </Button>
        </DesktopOnlyTooltip>
      </div>

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <template v-if="hasScanned && allItems.length > 0">
          <!-- Left panel: virtualized expense list -->
          <component
            :is="isSinglePanel ? 'div' : ScrollArea"
            ref="leftScrollAreaRef"
            class="w-full shrink-0 lg:w-80 lg:border-r"
          >
            <div ref="listRef" :style="{ height: `${totalSize}px`, width: '100%', position: 'relative' }">
              <div
                v-for="virtualRow in virtualRows"
                :key="String(virtualRow.key)"
                :style="{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                }"
              >
                <template v-if="virtualRow.index < allItems.length">
                  <div class="px-2 py-0.5">
                    <ExpenseListItem
                      :item="allItems[virtualRow.index]!"
                      :is-selected="selectedItemIndex === virtualRow.index"
                      @select="handleSelectExpense(virtualRow.index)"
                    />
                  </div>
                </template>
                <template v-else>
                  <div
                    v-if="!pageLoadFailed"
                    class="text-muted-foreground flex items-center justify-center py-3 text-xs"
                  >
                    {{ $t('optimizations.transferSuggestions.scanning') }}
                  </div>
                </template>
              </div>
            </div>
          </component>

          <!-- Right panel: suggestions (desktop) -->
          <div class="hidden min-w-0 flex-1 flex-col overflow-hidden lg:flex">
            <div v-if="showAiRescanHint" class="bg-primary/10 @container shrink-0 border-b px-4 py-2.5 text-sm">
              <div class="flex flex-col gap-2 @lg:flex-row @lg:items-center @lg:gap-3">
                <div class="flex min-w-0 flex-1 gap-2.5">
                  <SparklesIcon class="text-primary-text mt-0.5 size-4 shrink-0" />
                  <div class="min-w-0">
                    <p class="font-semibold">
                      {{ $t('optimizations.transferSuggestions.aiReview.rescanBanner.title') }}
                    </p>
                    <p class="text-muted-foreground">
                      {{ $t('optimizations.transferSuggestions.aiReview.rescanBanner.body') }}
                    </p>
                  </div>
                </div>
                <Button size="sm" class="ml-6.5 shrink-0 self-start @lg:ml-0 @lg:self-center" @click="rescanWithAi">
                  {{ $t('optimizations.transferSuggestions.aiReview.rescanHint') }}
                </Button>
              </div>
            </div>
            <SuggestionsPanel
              :selected-item="selectedItem"
              :is-linking="linkMutation.isPending.value"
              :actions-disabled="actionsDisabled"
              :is-skipping="skipMutation.isPending.value"
              @link="handleLink"
              @skip="handleSkip"
              @record-click="handleTransactionClick"
            />
          </div>
        </template>

        <!-- Empty state (after scan, no results) -->
        <div
          v-else-if="hasScanned && allItems.length === 0 && !isScanning"
          class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12"
        >
          <SearchXIcon class="text-muted-foreground size-12" />
          <div class="text-center">
            <p class="font-medium">{{ $t('optimizations.transferSuggestions.empty.title') }}</p>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ $t('optimizations.transferSuggestions.empty.description') }}
            </p>
          </div>
        </div>

        <!-- Initial state (before first scan) -->
        <div
          v-else-if="!hasScanned && !isScanning"
          class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12"
        >
          <SparklesIcon class="text-muted-foreground size-12" />
          <div class="text-center">
            <p class="font-medium">{{ $t('optimizations.transferSuggestions.initial.title') }}</p>
            <p class="text-muted-foreground mt-1 max-w-md text-sm">
              {{ $t('optimizations.transferSuggestions.initial.description') }}
            </p>
          </div>
        </div>

        <!-- Loading state -->
        <div v-else-if="isScanning && allItems.length === 0" class="flex flex-1 items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3">
            <div class="bg-primary/30 size-8 animate-ping rounded-full" />
            <p class="text-muted-foreground text-sm">
              {{
                aiReview
                  ? $t('optimizations.transferSuggestions.aiReview.reviewing')
                  : $t('optimizations.transferSuggestions.scanning')
              }}
            </p>
          </div>
        </div>
      </div>
    </Card>

    <!-- Single-panel: suggestions in a dialog/drawer -->
    <ResponsiveDialog
      v-if="isSinglePanel"
      v-model:open="suggestionsDialogOpen"
      no-internal-scroll
      dialog-content-class="max-w-2xl max-h-[85vh] px-0 pb-0 overflow-hidden"
      drawer-content-class="max-h-[85vh] !px-0 !pb-0"
    >
      <template #title>
        <div class="px-4">
          {{ $t('optimizations.transferSuggestions.suggestionsFor') }}
        </div>
      </template>
      <SuggestionsPanel
        :selected-item="selectedItem"
        :is-linking="linkMutation.isPending.value"
        :actions-disabled="actionsDisabled"
        :is-skipping="skipMutation.isPending.value"
        @link="handleLink"
        @skip="handleSkip"
        @record-click="handleTransactionClick"
      />
    </ResponsiveDialog>

    <TransactionDetailsModal
      v-slot="{ requestClose, transaction, oppositeTransaction, committed, finish }"
      v-model:open="isDialogVisible"
      v-bind="dialogProps"
      :session="editSession"
      :mobile="isSinglePanel"
      :is-compact="isCompactDialog"
      @committed="refreshAfterTransactionCommit"
    >
      <ManageTransactionDialogContent
        ref="editSession"
        :transaction="transaction"
        :opposite-transaction="oppositeTransaction"
        @committed="committed"
        @deleted="closeDialog"
        @close-modal="finish"
        @request-close="requestClose"
      />
    </TransactionDetailsModal>
  </div>
</template>
