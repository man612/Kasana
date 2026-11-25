<script setup lang="ts">
import PrecisionNumber from '@/components/common/precision-number.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { isBeiStock } from '@/common/utils/investment-units';
import InvestmentTransactionForm from '@/components/forms/investment-transaction-form.vue';
import { Button } from '@/components/lib/ui/button';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { useNotificationCenter } from '@/components/notification-center';
import { useDeleteHolding } from '@/composable/data-queries/holdings';
import { useFormatCurrency } from '@/composable/formatters';
import { toLocalNumber } from '@/js/helpers/formatters';
import { getGainColorClass } from '@/composable/gain-color';
import { useDateLocale } from '@/composable/use-date-locale';
import { getApiErrorMessage } from '@/js/errors';
import { captureException } from '@/lib/sentry';
import { useCurrenciesStore } from '@/stores/currencies';
import { ASSET_CLASS, type HoldingModel } from '@bt/shared/types/investments';
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockAlertIcon,
  PackageOpenIcon,
  PlusIcon,
  SearchXIcon,
  Trash2Icon,
} from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { revealInScrollViewport } from '@/composable/reveal-in-scroll-viewport';
import SecurityLogo from '@/components/common/security-logo.vue';

import HoldingTransactionsSection from './holding-transactions-section.vue';
import { useHoldingRowExpansion } from './composables/use-holding-row-expansion';
import {
  type HoldingSortKey,
  getAverageCost,
  getPrice,
  getTotalCost,
  groupHoldings,
  isPriceStale,
  sortHoldings,
} from './utils/holding-display';

// Crypto trades in much smaller units than typical stock fractional shares, so
// it needs more visible precision before falling back to a hover-reveal.
const QUANTITY_DECIMALS = { crypto: 4, default: 2 } as const;
const decimalsForAssetClass = (assetClass: ASSET_CLASS | undefined) =>
  assetClass === ASSET_CLASS.crypto ? QUANTITY_DECIMALS.crypto : QUANTITY_DECIMALS.default;

const props = defineProps<{
  holdings: HoldingModel[];
  loading?: boolean;
  error?: boolean;
  portfolioId: string;
  // When the user is filtering via search, closed positions are shown inline
  // alongside active ones (no collapsible section).
  isFiltering?: boolean;
  // Set of securityIds the user added during the current session. These rows
  // sort to the very top so the user can keep adding transactions on a fresh
  // holding without scrolling through the rest of the portfolio.
  justAddedIds?: ReadonlySet<string>;
}>();
const emit = defineEmits<{ (e: 'addSymbol'): void; (e: 'importTransactions'): void; (e: 'clearFilter'): void }>();

const { t } = useI18n();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();

const isTransactionModalOpen = ref(false);
const selectedHolding = ref<HoldingModel | null>(null);

const openTransactionModal = (holding: HoldingModel | null = null) => {
  selectedHolding.value = holding;
  isTransactionModalOpen.value = true;
};

const sortKey = ref<HoldingSortKey>('totalCost');
const sortDir = ref<'asc' | 'desc'>('desc');

const { formatAmountByCurrencyCode } = useFormatCurrency();
const { format: formatDate } = useDateLocale();
const { currencies } = storeToRefs(useCurrenciesStore());
const formatCurrency = (amount: number, currencyCode: string) => {
  const userCurrency = currencies.value.find((c) => c.currency?.code === currencyCode.toUpperCase());
  if (!userCurrency) {
    return toLocalNumber(amount, { maximumFractionDigits: 2 });
  }
  return formatAmountByCurrencyCode(amount, userCurrency.currencyCode);
};

const toggleSort = (key: HoldingSortKey) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
};

// Collapsible "Closed positions" section, collapsed by default.
const closedExpanded = ref(false);

const groupedHoldings = computed(() =>
  groupHoldings({
    holdings: props.holdings ?? [],
    sortKey: sortKey.value,
    sortDir: sortDir.value,
    justAddedIds: props.justAddedIds,
  }),
);

type DisplayRow = { kind: 'holding'; holding: HoldingModel } | { kind: 'closedToggle'; count: number };

/**
 * Flat list of rows to render. While filtering we show every match in one
 * combined sorted list; otherwise just-added rows lead, then active, then a
 * collapsible "Closed positions" toggle and (when expanded) the closed ones.
 */
const displayRows = computed<DisplayRow[]>(() => {
  if (props.isFiltering) {
    return sortHoldings({ holdings: props.holdings ?? [], sortKey: sortKey.value, sortDir: sortDir.value }).map(
      (holding) => ({ kind: 'holding', holding }),
    );
  }

  const { justAdded, active, closed } = groupedHoldings.value;
  const rows: DisplayRow[] = [
    ...justAdded.map((holding) => ({ kind: 'holding', holding }) as const),
    ...active.map((holding) => ({ kind: 'holding', holding }) as const),
  ];

  if (closed.length > 0) {
    rows.push({ kind: 'closedToggle', count: closed.length });
    if (closedExpanded.value) {
      rows.push(...closed.map((holding) => ({ kind: 'holding', holding }) as const));
    }
  }

  return rows;
});

const getUnrealizedGain = (holding: HoldingModel) => {
  return {
    value: Number(holding.unrealizedGainValue || 0),
    percent: Number(holding.unrealizedGainPercent || 0),
  };
};

const getRealizedGain = (holding: HoldingModel) => {
  return {
    value: Number(holding.realizedGainValue || 0),
    percent: Number(holding.realizedGainPercent || 0),
  };
};

// Money columns render display-currency values when present; Price and AC/Share stay native.
const formatMoneyCell = ({
  holding,
  native,
  display,
}: {
  holding: HoldingModel;
  native: number;
  display: string | undefined;
}) =>
  holding.displayCurrencyCode && display !== undefined
    ? formatCurrency(Number(display), holding.displayCurrencyCode)
    : formatCurrency(native, holding.currencyCode);

const { isExpanded, toggleExpand, collapseIfMatches } = useHoldingRowExpansion();

// Delete holding flow
const deleteHoldingMutation = useDeleteHolding();
const deleteConfirmOpen = ref(false);
const holdingPendingDelete = ref<HoldingModel | null>(null);

const openDeleteConfirm = (holding: HoldingModel) => {
  holdingPendingDelete.value = holding;
  deleteConfirmOpen.value = true;
};

const confirmDeleteHolding = async () => {
  const target = holdingPendingDelete.value;
  if (!target) return;
  try {
    await deleteHoldingMutation.mutateAsync({
      portfolioId: props.portfolioId,
      securityId: target.securityId,
      force: true,
    });
    addSuccessNotification(t('portfolioDetail.holdingsTable.deleteHolding.success'));
    collapseIfMatches(target.securityId);
  } catch (err) {
    const message = getApiErrorMessage({
      e: err,
      t,
      conflictKey: 'portfolioDetail.holdingsTable.deleteHolding.error',
      fallbackKey: 'portfolioDetail.holdingsTable.deleteHolding.error',
    });
    addErrorNotification(message);
    captureException({
      error: err,
      context: { source: 'confirmDeleteHolding', portfolioId: props.portfolioId, securityId: target.securityId },
    });
  } finally {
    deleteConfirmOpen.value = false;
    holdingPendingDelete.value = null;
  }
};

const cellStyles = 'py-0.5';
const theadCellStyles = 'py-2';
const theadBgStyles = 'bg-muted';
// Chevron + Symbol cells pin to the left during horizontal scroll. They need
// an opaque bg (scrolled columns would show through), so the row's transparent
// bg-muted/30 hover is pre-blended with the card bg via color-mix.
const stickyBodyCellStyles =
  'sticky z-1 bg-card transition-colors group-hover:bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))]';
// Single-line header labels: the cap keeps long (localized) labels from
// wrapping or blowing up column widths; overflow turns into an ellipsis.
const theadLabelStyles = 'block max-w-32 truncate';
const formId = useId();
const visitedHoldings = ref(new Set<string>());
const holdingPanelId = (securityId: string) => `${formId}-holding-${securityId}`;
const toggleHoldingPanel = async (securityId: string) => {
  if (isExpanded(securityId)) {
    toggleExpand(securityId);
    return;
  }
  visitedHoldings.value.add(securityId);
  toggleExpand(securityId);
  await nextTick();
  const panel = document.getElementById(holdingPanelId(securityId));
  if (!panel) return;
  const animations = panel.getAnimations();
  await Promise.allSettled(animations.map((animation) => animation.finished));
  if (!panel.isConnected || !isExpanded(securityId)) return;
  const viewport = panel.closest<HTMLElement>('.lajur-detail-scroll-viewport');
  if (viewport) revealInScrollViewport({ target: panel, viewport });
};
const actionForm = useTemplateRef<InstanceType<typeof InvestmentTransactionForm>>('action-form');
</script>

<template>
  <div>
    <!-- Loading State with Skeleton -->
    <div v-if="loading" class="py-8">
      <div class="space-y-1">
        <div class="flex items-center gap-4 border-b pb-2">
          <div class="h-4 w-8"></div>
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-32 animate-pulse rounded"></div>
          <div class="bg-muted ml-auto h-4 w-16 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
          <div class="bg-muted h-8 w-20 animate-pulse rounded"></div>
          <div class="bg-muted h-8 w-20 animate-pulse rounded"></div>
        </div>
        <div v-for="i in 5" :key="i" class="flex items-center gap-4 py-3">
          <div class="bg-muted h-8 w-8 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-32 animate-pulse rounded"></div>
          <div class="bg-muted ml-auto h-4 w-16 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
          <div class="flex h-10 flex-col justify-center gap-1">
            <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
            <div class="bg-muted h-3 w-16 animate-pulse rounded"></div>
          </div>
          <div class="flex h-10 flex-col justify-center gap-1">
            <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
            <div class="bg-muted h-3 w-16 animate-pulse rounded"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="py-12 text-center">
      <div class="bg-destructive/10 mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
        <AlertCircleIcon class="text-destructive-text size-6" />
      </div>
      <p class="text-destructive-text mb-2 font-medium">{{ $t('portfolioDetail.holdingsTable.loadError') }}</p>
      <p class="text-muted-foreground text-sm">{{ $t('portfolioDetail.holdingsTable.tryAgainLater') }}</p>
    </div>

    <!-- No Search Matches State: holdings exist, the filter just excluded all of them -->
    <div v-else-if="isFiltering && (!holdings || holdings.length === 0)" class="py-12 text-center">
      <div class="bg-muted mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <SearchXIcon class="text-muted-foreground size-6" />
      </div>
      <p class="text-foreground mb-2 font-medium">{{ $t('portfolioDetail.holdingsTable.noFilterResults') }}</p>
      <p class="text-muted-foreground mb-4 text-sm">
        {{ $t('portfolioDetail.holdingsTable.noFilterResultsDescription') }}
      </p>
      <Button variant="outline" @click="emit('clearFilter')">
        {{ $t('portfolioDetail.holdingsTable.clearFilterButton') }}
      </Button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!holdings || holdings.length === 0" class="py-12 text-center">
      <div class="bg-muted mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <PackageOpenIcon class="text-muted-foreground size-6" />
      </div>
      <p class="text-foreground mb-2 font-medium">{{ $t('portfolioDetail.holdingsTable.empty') }}</p>
      <p class="text-muted-foreground mb-4 text-sm">{{ $t('portfolioDetail.holdingsTable.emptyDescription') }}</p>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" @click="emit('addSymbol')">
          <PlusIcon class="mr-2 size-4" />
          {{ $t('portfolioDetail.holdingsTable.addFirstHolding') }}
        </Button>
        <Button variant="ghost" @click="emit('importTransactions')">
          {{ $t('portfolioDetail.holdingsTable.importTransactions') }}
        </Button>
      </div>
    </div>

    <!-- Holdings Table -->
    <!-- @container: the expanded transactions section sizes itself to 100cqw. -->
    <ScrollArea
      v-else
      data-no-nav-swipe
      class="@container"
      viewport-class="overscroll-x-none"
      with-horizontal-scrollbar
    >
      <!-- pb-2.5 keeps the overlay horizontal scrollbar off the last row. -->
      <div class="pb-2.5">
        <table class="w-full min-w-0 @3xl:min-w-235">
          <thead class="text-muted-foreground sr-only @3xl:not-sr-only">
            <tr class="text-xs font-medium tracking-wider uppercase">
              <!-- Chevron + symbol share one sticky cell: separate cells leave a
                   seam where scrolled columns peek through between them. -->
              <th :class="[theadCellStyles, theadBgStyles, 'sticky left-0 z-1 pr-3 pl-13 text-left']">
                <button
                  class="hover:text-foreground flex items-center gap-1 transition-colors"
                  @click="toggleSort('symbol')"
                >
                  <span :class="theadLabelStyles">{{ $t('portfolioDetail.holdingsTable.headers.symbol') }}</span>
                  <ArrowUpIcon v-if="sortKey === 'symbol' && sortDir === 'asc'" class="size-3" />
                  <ArrowDownIcon v-if="sortKey === 'symbol' && sortDir === 'desc'" class="size-3" />
                </button>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'px-3 text-left']">
                <span :class="theadLabelStyles">{{ $t('portfolioDetail.holdingsTable.headers.name') }}</span>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'hidden px-3 text-right @3xl:table-cell']">
                <button
                  class="hover:text-foreground flex w-full items-center justify-end gap-1 transition-colors"
                  @click="toggleSort('quantity')"
                >
                  <span :class="theadLabelStyles">{{ $t('portfolioDetail.holdingsTable.headers.shares') }}</span>
                  <ArrowUpIcon v-if="sortKey === 'quantity' && sortDir === 'asc'" class="size-3" />
                  <ArrowDownIcon v-if="sortKey === 'quantity' && sortDir === 'desc'" class="size-3" />
                </button>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'hidden px-3 text-right @3xl:table-cell']">
                <span :class="theadLabelStyles">{{ $t('portfolioDetail.holdingsTable.headers.price') }}</span>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'hidden px-3 text-right @3xl:table-cell']">
                <button
                  class="hover:text-foreground flex w-full items-center justify-end gap-1 transition-colors"
                  @click="toggleSort('avgCost')"
                >
                  <span :class="theadLabelStyles">{{
                    $t('portfolioDetail.holdingsTable.headers.avgCostPerShare')
                  }}</span>
                  <ArrowUpIcon v-if="sortKey === 'avgCost' && sortDir === 'asc'" class="size-3" />
                  <ArrowDownIcon v-if="sortKey === 'avgCost' && sortDir === 'desc'" class="size-3" />
                </button>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'hidden px-3 text-right @3xl:table-cell']">
                <button
                  class="hover:text-foreground flex w-full items-center justify-end gap-1 transition-colors"
                  @click="toggleSort('totalCost')"
                >
                  <span :class="theadLabelStyles">{{ $t('portfolioDetail.holdingsTable.headers.totalCost') }}</span>
                  <ArrowUpIcon v-if="sortKey === 'totalCost' && sortDir === 'asc'" class="size-3" />
                  <ArrowDownIcon v-if="sortKey === 'totalCost' && sortDir === 'desc'" class="size-3" />
                </button>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'hidden px-3 text-right @3xl:table-cell']">
                <button
                  class="hover:text-foreground flex w-full items-center justify-end gap-1 transition-colors"
                  @click="toggleSort('value')"
                >
                  <span :class="theadLabelStyles">{{ $t('portfolioDetail.holdingsTable.headers.marketValue') }}</span>
                  <ArrowUpIcon v-if="sortKey === 'value' && sortDir === 'asc'" class="size-3" />
                  <ArrowDownIcon v-if="sortKey === 'value' && sortDir === 'desc'" class="size-3" />
                </button>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'hidden px-3 text-right @3xl:table-cell']">
                <button
                  class="hover:text-foreground flex w-full items-center justify-end gap-1 transition-colors"
                  @click="toggleSort('unrealizedGain')"
                >
                  <span :class="theadLabelStyles">{{
                    $t('portfolioDetail.holdingsTable.headers.unrealizedGain')
                  }}</span>
                  <ArrowUpIcon v-if="sortKey === 'unrealizedGain' && sortDir === 'asc'" class="size-3" />
                  <ArrowDownIcon v-if="sortKey === 'unrealizedGain' && sortDir === 'desc'" class="size-3" />
                </button>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'hidden px-3 text-right @3xl:table-cell']">
                <button
                  class="hover:text-foreground flex w-full items-center justify-end gap-1 transition-colors"
                  @click="toggleSort('realizedGain')"
                >
                  <span :class="theadLabelStyles">{{ $t('portfolioDetail.holdingsTable.headers.realizedGain') }}</span>
                  <ArrowUpIcon v-if="sortKey === 'realizedGain' && sortDir === 'asc'" class="size-3" />
                  <ArrowDownIcon v-if="sortKey === 'realizedGain' && sortDir === 'desc'" class="size-3" />
                </button>
              </th>
              <th :class="[theadCellStyles, theadBgStyles, 'w-10 text-right']"></th>
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            <template
              v-for="row in displayRows"
              :key="row.kind === 'closedToggle' ? 'closed-positions-toggle' : row.holding.securityId"
            >
              <!-- Inline collapsible "Closed positions" section header -->
              <tr
                v-if="row.kind === 'closedToggle'"
                class="bg-muted/40 hover:bg-muted/70 cursor-pointer text-sm transition-colors"
                @click="closedExpanded = !closedExpanded"
              >
                <td :class="[cellStyles, 'py-1']">
                  <Button variant="ghost" size="icon" class="size-8" @click.stop="closedExpanded = !closedExpanded">
                    <ChevronDownIcon v-if="closedExpanded" class="size-4" />
                    <ChevronRightIcon v-else class="size-4" />
                  </Button>
                </td>
                <td colspan="9" :class="[cellStyles, 'px-3']">
                  <div class="text-muted-foreground flex items-center gap-2 font-medium">
                    <ArchiveIcon class="size-4" />
                    {{ $t('portfolioDetail.holdingsTable.closedPositions', { count: row.count }) }}
                  </div>
                </td>
              </tr>
              <template v-else>
                <tr class="hover:bg-muted/30 group text-sm transition-colors">
                  <td :class="[cellStyles, stickyBodyCellStyles, 'left-0 py-1 pr-1 font-semibold @3xl:pr-3']">
                    <div class="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-8 shrink-0"
                        :aria-label="row.holding.security?.symbol ?? $t('portfolioDetail.holdings.title')"
                        :aria-expanded="isExpanded(row.holding.securityId)"
                        :aria-controls="holdingPanelId(row.holding.securityId)"
                        @click="toggleHoldingPanel(row.holding.securityId)"
                      >
                        <ChevronRightIcon
                          class="size-4 motion-safe:transition-transform"
                          :class="isExpanded(row.holding.securityId) && 'rotate-90'"
                        />
                      </Button>
                      <SecurityLogo v-if="row.holding.security" :security="row.holding.security" />
                      <span class="min-w-0">
                        <span class="block">{{ row.holding.security?.symbol }}</span>
                        <span class="text-muted-foreground block max-w-28 truncate text-xs font-normal @3xl:hidden">
                          {{ row.holding.security?.name }}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td :class="[cellStyles, 'text-muted-foreground hidden max-w-50 truncate px-3 @3xl:table-cell']">
                    {{ row.holding.security?.name }}
                  </td>
                  <td :class="[cellStyles, 'hidden px-3 text-right tabular-nums @3xl:table-cell']">
                    <PrecisionNumber
                      :value="row.holding.quantity"
                      :max-decimals="decimalsForAssetClass(row.holding.security?.assetClass)"
                    />
                  </td>
                  <td :class="[cellStyles, 'hidden px-3 text-right tabular-nums @3xl:table-cell']">
                    {{ row.holding.priceDate ? formatCurrency(getPrice(row.holding), row.holding.currencyCode) : '—' }}
                    <DesktopOnlyTooltip
                      v-if="isPriceStale({ holding: row.holding })"
                      content-class-name="max-w-60"
                      :content="$t('portfolioDetail.holdingsTable.stalePrice')"
                    >
                      <div class="text-warning-text flex items-center justify-end gap-1 text-xs">
                        <ClockAlertIcon class="size-3" />
                        {{ formatDate(row.holding.priceDate!, 'd MMM yyyy') }}
                      </div>
                    </DesktopOnlyTooltip>
                    <span v-else-if="row.holding.priceDate" class="text-muted-foreground block text-xs">
                      {{ formatDate(row.holding.priceDate, 'd MMM yyyy') }}
                    </span>
                    <span v-else class="text-muted-foreground block text-xs">
                      {{ $t('portfolioDetail.holdingsTable.noMarketPrice') }}
                    </span>
                  </td>
                  <td
                    :class="[cellStyles, 'text-muted-foreground hidden px-3 text-right tabular-nums @3xl:table-cell']"
                  >
                    {{ formatCurrency(getAverageCost(row.holding), row.holding.currencyCode) }}
                  </td>
                  <td :class="[cellStyles, 'hidden px-3 text-right tabular-nums @3xl:table-cell']">
                    {{
                      formatMoneyCell({
                        holding: row.holding,
                        native: getTotalCost(row.holding),
                        display: row.holding.displayCostBasis,
                      })
                    }}
                  </td>
                  <td :class="[cellStyles, 'px-1 text-right text-xs font-medium tabular-nums @3xl:px-3 @3xl:text-sm']">
                    <span class="text-muted-foreground block text-[0.625rem] @3xl:hidden">
                      {{ $t('portfolioDetail.holdingsTable.headers.marketValue') }}
                    </span>
                    {{
                      row.holding.priceDate
                        ? formatMoneyCell({
                            holding: row.holding,
                            native: Number(row.holding.marketValue || 0),
                            display: row.holding.displayMarketValue,
                          })
                        : '—'
                    }}
                  </td>
                  <td :class="[cellStyles, 'hidden px-3 text-right @3xl:table-cell']">
                    <div
                      v-if="row.holding.priceDate"
                      :class="getGainColorClass({ gainValue: getUnrealizedGain(row.holding).value })"
                      class="tabular-nums"
                    >
                      <div class="font-semibold">
                        {{
                          formatMoneyCell({
                            holding: row.holding,
                            native: getUnrealizedGain(row.holding).value,
                            display: row.holding.displayUnrealizedGainValue,
                          })
                        }}
                      </div>
                      <div class="text-xs">{{ getUnrealizedGain(row.holding).percent.toFixed(2) }}%</div>
                    </div>
                    <span v-else class="text-muted-foreground">—</span>
                  </td>
                  <td :class="[cellStyles, 'hidden px-3 text-right @3xl:table-cell']">
                    <div
                      :class="getGainColorClass({ gainValue: getRealizedGain(row.holding).value })"
                      class="tabular-nums"
                    >
                      <div class="font-semibold">
                        {{
                          formatMoneyCell({
                            holding: row.holding,
                            native: getRealizedGain(row.holding).value,
                            display: row.holding.displayRealizedGainValue,
                          })
                        }}
                      </div>
                      <div class="text-xs">{{ getRealizedGain(row.holding).percent.toFixed(2) }}%</div>
                    </div>
                  </td>
                  <td :class="[cellStyles, 'py-1 pr-2 text-right']">
                    <DesktopOnlyTooltip :content="$t('portfolioDetail.holdingsTable.deleteHolding.ariaLabel')">
                      <Button
                        variant="ghost-destructive"
                        size="icon"
                        class="size-8"
                        :aria-label="$t('portfolioDetail.holdingsTable.deleteHolding.ariaLabel')"
                        @click="openDeleteConfirm(row.holding)"
                      >
                        <Trash2Icon class="size-4" />
                      </Button>
                    </DesktopOnlyTooltip>
                  </td>
                </tr>
                <!-- Expanded transactions section -->
                <tr v-if="visitedHoldings.has(row.holding.securityId)" class="bg-muted/20">
                  <td colspan="10" class="p-0">
                    <LayoutCollapse
                      :id="holdingPanelId(row.holding.securityId)"
                      :open="isExpanded(row.holding.securityId)"
                    >
                      <dl class="grid grid-cols-2 gap-2 px-3 py-2 text-xs @3xl:hidden">
                        <div>
                          <dt class="text-muted-foreground">
                            {{ $t('portfolioDetail.holdingsTable.headers.shares') }}
                          </dt>
                          <dd>
                            <PrecisionNumber
                              :value="row.holding.quantity"
                              :max-decimals="decimalsForAssetClass(row.holding.security?.assetClass)"
                            />
                          </dd>
                        </div>
                        <div>
                          <dt class="text-muted-foreground">{{ $t('portfolioDetail.holdingsTable.headers.price') }}</dt>
                          <dd>
                            {{
                              row.holding.priceDate
                                ? formatCurrency(getPrice(row.holding), row.holding.currencyCode)
                                : '—'
                            }}
                          </dd>
                        </div>
                        <div>
                          <dt class="text-muted-foreground">
                            {{ $t('portfolioDetail.holdingsTable.headers.totalCost') }}
                          </dt>
                          <dd>
                            {{
                              formatMoneyCell({
                                holding: row.holding,
                                native: getTotalCost(row.holding),
                                display: row.holding.displayCostBasis,
                              })
                            }}
                          </dd>
                        </div>
                        <div>
                          <dt class="text-muted-foreground">
                            {{ $t('portfolioDetail.holdingsTable.headers.unrealizedGain') }}
                          </dt>
                          <dd>
                            {{
                              row.holding.priceDate
                                ? formatMoneyCell({
                                    holding: row.holding,
                                    native: getUnrealizedGain(row.holding).value,
                                    display: row.holding.displayUnrealizedGainValue,
                                  })
                                : '—'
                            }}
                          </dd>
                        </div>
                      </dl>
                      <HoldingTransactionsSection
                        :portfolio-id="portfolioId"
                        :security-id="row.holding.securityId"
                        @add-transaction="openTransactionModal(row.holding)"
                      />
                    </LayoutCollapse>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </ScrollArea>

    <ResponsiveDialog
      v-model:open="isTransactionModalOpen"
      custom-close
      centered-title
      fit-keyboard
      dialog-content-class="sm:max-w-2xl"
    >
      <template #title>{{ $t('portfolioDetail.holdingsTable.addTransactionDialog.title') }}</template>
      <InvestmentTransactionForm
        ref="action-form"
        :form-id="formId"
        :portfolio-id="portfolioId"
        :securities="
          holdings.map((hh) => ({
            value: String(hh.securityId),
            label: hh.security?.name
              ? `${hh.security.name} (${hh.security.symbol})`
              : (hh.security?.symbol ?? 'Unknown'),
            currencyCode: hh.currencyCode,
            isBeiStock: isBeiStock(hh.security ?? undefined),
          }))
        "
        :security-id="selectedHolding?.securityId ? String(selectedHolding.securityId) : undefined"
        @success="isTransactionModalOpen = false"
        @cancel="isTransactionModalOpen = false"
      />
      <template #footer>
        <UiButton
          type="button"
          variant="secondary"
          :disabled="actionForm?.isSubmitting"
          @click="isTransactionModalOpen = false"
        >
          {{ $t('forms.investmentTransaction.cancelButton') }}
        </UiButton>
        <UiButton type="submit" :form="formId" :disabled="actionForm?.isSubmitDisabled ?? true">
          {{
            actionForm?.isSubmitting
              ? $t('forms.investmentTransaction.submitButtonLoading')
              : $t('forms.investmentTransaction.submitButton')
          }}
        </UiButton>
      </template>
    </ResponsiveDialog>

    <ResponsiveAlertDialog
      v-model:open="deleteConfirmOpen"
      :confirm-label="$t('portfolioDetail.holdingsTable.deleteHolding.confirmLabel')"
      confirm-variant="destructive"
      :confirm-disabled="deleteHoldingMutation.isPending.value"
      @confirm="confirmDeleteHolding"
    >
      <template #title>{{ $t('portfolioDetail.holdingsTable.deleteHolding.title') }}</template>
      <template #description>
        <i18n-t keypath="portfolioDetail.holdingsTable.deleteHolding.description" tag="span">
          <template #symbol>
            <strong>{{ holdingPendingDelete?.security?.symbol ?? '' }}</strong>
          </template>
        </i18n-t>
      </template>
    </ResponsiveAlertDialog>
  </div>
</template>
