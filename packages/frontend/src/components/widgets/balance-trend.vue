<template>
  <WidgetWrapper :is-fetching="isWidgetDataFetching" class="@container/balance min-h-0" fit-content>
    <template #title>
      {{ $t('dashboard.widgets.balanceTrend.title') }}
    </template>
    <template v-if="widgetConfigRef" #action>
      <BalanceTrendSettingsPopover :is-projection-active="projection !== null" />
    </template>
    <template v-if="isInitialLoading">
      <LoadingState />
    </template>
    <template v-else-if="balanceHistoryError && isDataEmpty">
      <WidgetUnavailable @retry="refetchBalanceHistory()" />
    </template>
    <template v-else-if="isDataEmpty">
      <EmptyState>
        <ChartLineIcon class="size-12 opacity-60" />
      </EmptyState>
    </template>
    <template v-else>
      <div class="mb-2">
        <PillTabs
          role="group"
          :aria-label="$t('dashboard.widgets.balanceTrend.presentation.component')"
          data-testid="balance-trend-components"
          size="sm"
          scrollable
          :items="balanceTypeOptions"
          :model-value="selectedBalanceType.value"
          @update:model-value="selectBalanceTypeValue"
        />
      </div>
      <p v-if="balanceHistoryError" class="text-warning-text mb-2 text-xs" role="status">
        {{ $t('dashboard.widgets.common.staleData') }}
        <Button variant="link" size="sm" @click="refetchBalanceHistory()">{{ $t('common.actions.retry') }}</Button>
      </p>
      <div
        data-tab-swipe
        data-testid="balance-trend-swipe"
        class="mb-2 grid min-w-0 touch-pan-y grid-cols-1 gap-2 @md/balance:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        @touchstart.passive="balanceSwipe.begin"
        @touchend.passive="balanceSwipe.end"
        @touchcancel="balanceSwipe.cancel"
      >
        <div class="min-w-0">
          <FitAmount
            :value="animatedBalance"
            :target="displayBalance.current"
            class="text-xl leading-tight font-bold tracking-tight tabular-nums sm:text-3xl"
          />
          <p class="text-muted-foreground mt-1 text-xs" data-testid="balance-trend-as-of">{{ periodLabel }}</p>
        </div>

        <!-- Right: Comparison -->
        <div class="flex min-w-0 flex-col items-start gap-1 sm:items-end">
          <div v-if="balancesDiffAbsolute !== null" class="flex max-w-full items-center gap-1.5">
            <FitAmount
              :value="balancesDiffAbsolute"
              signed
              class="max-w-full text-sm font-semibold tracking-tight sm:flex-1 sm:text-right"
              :class="{
                'text-app-expense-color': comparisonTone < 0,
                'text-success-text': comparisonTone > 0,
                'text-muted-foreground': comparisonTone === 0,
              }"
            />

            <span
              v-if="balancesDiff !== null"
              class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="{
                'bg-app-expense-color/15 text-app-expense-color': comparisonTone < 0,
                'bg-success-text/15 text-success-text': comparisonTone > 0,
                'bg-muted text-muted-foreground': comparisonTone === 0,
              }"
            >
              {{ balancesDiff === null ? '—' : `${balancesDiff > 0 ? '+' : ''}${balancesDiff}%` }}
            </span>
          </div>
          <div v-if="balancesDiffAbsolute !== null" class="text-muted-foreground text-xs">
            {{ $t('dashboard.widgets.balanceTrend.vsPreviousPeriod') }}
          </div>
        </div>
      </div>

      <div
        ref="miniContainer"
        class="min-w-0 px-1"
        data-testid="balance-trend-sparkline"
        :aria-busy="isWidgetDataFetching"
      >
        <svg
          v-if="miniTrend"
          viewBox="0 0 300 48"
          class="text-primary-text h-16 w-full touch-pan-y"
          preserveAspectRatio="none"
          role="img"
          :aria-label="$t('dashboard.widgets.balanceTrend.title')"
          @pointerenter="inspectMini"
          @pointerdown="inspectMini"
          @pointermove="inspectMini"
          @pointerup="finishTooltipPointer"
          @pointercancel="hidePoint()"
          @pointerleave="leaveChart"
        >
          <!-- The unpainted parts of the SVG must accept pointer input too. -->
          <rect width="300" height="48" fill="transparent" pointer-events="all" aria-hidden="true" />
          <path :d="miniAnimation?.area ?? miniTrend.area" fill="currentColor" opacity="0.13" />
          <path
            :d="miniAnimation?.path ?? miniTrend.path"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />
          <circle :cx="miniTrend.end.x" :cy="miniTrend.end.y" r="2.5" fill="currentColor" />
          <g
            v-if="!showDetails && tooltip.visible && inspectedDate !== null"
            :transform="`translate(${miniTrend.x(inspectedDate)},0)`"
            class="pointer-events-none"
            aria-hidden="true"
          >
            <line
              data-testid="balance-trend-guide"
              y1="2"
              y2="46"
              stroke="currentColor"
              stroke-opacity="0.5"
              stroke-dasharray="3,3"
              vector-effect="non-scaling-stroke"
            />
            <circle :cy="miniTrend.y(tooltip.totalBalance)" r="3" fill="currentColor" />
          </g>
        </svg>
      </div>
      <!-- Tooltip is teleported so transforms/overflow on widgets never offset fixed viewport coordinates. -->
      <Teleport to="body">
        <Transition name="lajur-chart-tooltip">
          <div
            v-show="tooltip.visible && !spikePanel.visible"
            ref="tooltipRef"
            data-testid="balance-trend-tooltip"
            class="pointer-events-none fixed top-0 left-0 isolate max-w-[calc(100vw-1.25rem)]"
            :class="showDetails ? 'z-(--z-chart-in-dialog)' : 'z-(--z-chart-floating)'"
            :style="{ translate: `${tooltip.x}px ${tooltip.y}px` }"
          >
            <ChartTooltip>
              <ChartTooltipHeader>{{ tooltip.date }}</ChartTooltipHeader>

              <ChartTooltipRow v-for="row in tooltipComponentRows" :key="row.key" :label="row.label">
                <template #value>
                  {{ formatBaseCurrency(row.value)
                  }}<span
                    v-if="shouldDisplayBalanceDelta({ delta: row.delta })"
                    class="ml-1 text-xs font-medium"
                    :class="deltaColorClass(row.delta)"
                    >({{ formatBalanceDelta({ delta: row.delta, currency: tooltipCurrency }) }})</span
                  >
                </template>
              </ChartTooltipRow>

              <ChartTooltipDivider v-if="tooltipComponentRows.length" />

              <ChartTooltipRow
                total
                :label="
                  selectedBalanceType.value === 'total'
                    ? $t('dashboard.widgets.balanceTrend.tooltip.total')
                    : metricLabel
                "
                :value="formatBaseCurrency(tooltip.totalBalance)"
              />

              <div
                v-if="tooltip.deltaAbsolute !== null"
                class="mt-1 text-xs font-semibold tabular-nums"
                :class="deltaColorClass(usesLoanBalance ? -tooltip.deltaAbsolute : tooltip.deltaAbsolute)"
              >
                {{ formatBalanceDelta({ delta: tooltip.deltaAbsolute, currency: tooltipCurrency }) }}
                <template v-if="tooltip.deltaPercent !== null">
                  ({{ formatBalanceDeltaPercent({ percent: tooltip.deltaPercent }) }})
                </template>
              </div>
            </ChartTooltip>
          </div>
        </Transition>
      </Teleport>

      <ResponsiveDialog
        v-model:open="showDetails"
        dialog-content-class="sm:max-w-2xl"
        drawer-content-class="max-h-[90dvh]"
        intrinsic-height-motion
      >
        <template #trigger>
          <Button
            type="button"
            variant="ghost"
            class="min-h-11 w-full justify-between px-1"
            data-testid="balance-trend-details"
          >
            {{ $t('dashboard.widgets.balanceTrend.presentation.details') }}
            <ChevronRightIcon class="text-muted-foreground size-4" aria-hidden="true" />
          </Button>
        </template>
        <template #title>{{ $t('dashboard.widgets.balanceTrend.presentation.details') }}</template>
        <template #description>{{ metricLabel }} · {{ periodLabel }}</template>
        <div class="min-w-0 space-y-4">
          <div data-testid="balance-trend-summary" class="grid gap-2 pb-1 text-xs">
            <p class="text-muted-foreground leading-relaxed">{{ metricDescription }}</p>
            <dl v-if="summaryStats" class="border-border/60 grid grid-cols-2 gap-3 border-t pt-2">
              <div class="min-w-0">
                <dt class="text-muted-foreground">
                  {{ $t('dashboard.widgets.balanceTrend.presentation.periodStart') }}
                </dt>
                <dd><FitAmount :value="summaryStats.start" class="pt-0.5 text-sm font-medium" /></dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">
                  {{ $t('dashboard.widgets.balanceTrend.presentation.periodChange') }}
                </dt>
                <dd><FitAmount :value="summaryStats.change" signed class="pt-0.5 text-sm font-medium" /></dd>
              </div>
            </dl>
          </div>
          <!-- Projected balance from pending plans; the headline above stays real-money only. -->
          <i18n-t
            v-if="projection"
            keypath="dashboard.widgets.balanceTrend.projection.summary"
            :plural="projection.planCount"
            tag="div"
            data-testid="bt-projection-summary"
            class="max-xs:px-2 text-muted-foreground -mt-2 mb-3 text-xs"
          >
            <template #amount>
              <span class="text-foreground text-sm font-semibold">{{
                formatBaseCurrency(projection.projectedValue)
              }}</span>
            </template>
            <template #count>{{ projection.planCount }}</template>
            <template #date>{{ projectionThroughDate }}</template>
          </i18n-t>

          <div ref="containerRef" data-no-nav-swipe data-vaul-no-drag class="max-xs:px-1 relative h-52 w-full sm:h-64">
            <svg
              ref="svgRef"
              class="focus-visible:ring-ring h-full w-full touch-pan-y focus-visible:ring-2 focus-visible:outline-none"
              role="group"
              :aria-label="$t('dashboard.widgets.balanceTrend.title')"
              :tabindex="canPanChart ? 0 : undefined"
              @pointerdown="rememberChartPointer"
              @pointerup="finishChartPointer"
              @pointercancel="cancelChartPointer"
              @pointerleave="leaveChart"
              @click.capture="protectChartPan"
              @keydown.left.prevent="moveChartWindow({ points: -CHART_WINDOW_POINTS })"
              @keydown.right.prevent="moveChartWindow({ points: CHART_WINDOW_POINTS })"
            ></svg>

            <!-- Spike transactions panel -->
            <SpikeTransactionsPanel
              :visible="spikePanel.visible"
              :anchor="spikeAnchor"
              :spike-date="spikeDateLabel"
              :delta-absolute="spikePanel.spikePoint?.deltaAbsolute ?? 0"
              :delta-percent="spikePanel.deltaPercent"
              :is-positive="spikePanel.spikePoint ? spikePanel.spikePoint.isPositive !== usesLoanBalance : true"
              :transactions="spikeTransactions ?? []"
              :is-loading="isSpikeTransactionsLoading"
              :is-portfolio-mode="isPortfolioMode"
              :accounts-delta="spikePanel.accountsDelta"
              :portfolios-delta="spikePanel.portfoliosDelta"
              :selected-balance-type="selectedBalanceType.value"
              :currency-code="baseCurrency?.currency?.code"
              @close="closeSpikePanel"
              @see-all="navigateToSpikeTransactions"
            />
          </div>
          <div v-if="canPanChart" class="flex flex-wrap items-center justify-end gap-1">
            <DesktopOnlyTooltip :content="$t('dashboard.periodSelector.previousPeriod')">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                :aria-label="$t('dashboard.periodSelector.previousPeriod')"
                :disabled="chartWindowStart === 0"
                @click="moveChartWindow({ points: -CHART_WINDOW_POINTS })"
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
            </DesktopOnlyTooltip>
            <DesktopOnlyTooltip :content="$t('dashboard.periodSelector.nextPeriod')">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                :aria-label="$t('dashboard.periodSelector.nextPeriod')"
                :disabled="chartWindowStart === lastChartWindowStart"
                @click="moveChartWindow({ points: CHART_WINDOW_POINTS })"
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </DesktopOnlyTooltip>
            <Button v-if="chartWindowStart !== null" type="button" size="sm" variant="ghost" @click="resetChartWindow">
              {{ $t('dashboard.widgets.balanceTrend.showFullRange') }}
            </Button>
          </div>

          <section class="border-border/60 border-t pt-2 text-xs">
            <h3 class="text-foreground mb-1 font-semibold">{{ $t('dashboard.widgets.balanceTrend.table.toggle') }}</h3>
            <ScrollArea class="max-h-56 min-w-0" viewport-class="max-h-56 overscroll-contain" data-vaul-no-drag>
              <table class="w-full table-fixed text-sm tabular-nums">
                <caption class="sr-only">
                  {{
                    $t('dashboard.widgets.balanceTrend.title')
                  }}
                </caption>
                <colgroup>
                  <col class="w-26" />
                  <col />
                </colgroup>
                <thead class="bg-card sticky top-0 z-1">
                  <tr class="text-muted-foreground border-border/50 border-b text-left text-xs">
                    <th scope="col" class="px-2 py-2 font-medium">
                      {{ $t('dashboard.widgets.balanceTrend.table.date') }}
                    </th>
                    <th scope="col" class="py-2 pr-3 text-right font-medium">
                      {{ $t('dashboard.widgets.balanceTrend.table.amount') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="point in chartTableRows"
                    :key="point.date"
                    class="border-border/30 hover:bg-muted/40 cursor-pointer border-b transition-colors last:border-0 motion-reduce:transition-none"
                    :class="inspectedDate === point.date && 'bg-primary/10'"
                    @click.stop="selectTablePoint({ point })"
                  >
                    <td>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-auto min-h-9 w-full justify-start px-2 py-1.5 text-xs whitespace-normal"
                        :aria-pressed="inspectedDate === point.date"
                        @click.stop="selectTablePoint({ point })"
                      >
                        {{ formatDate(point.date, 'PP') }}
                      </Button>
                    </td>
                    <td class="py-1.5 pr-3 pl-2 text-right font-medium wrap-anywhere">
                      {{ formatBaseCurrency(point.value) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </ScrollArea>
          </section>
        </div>
      </ResponsiveDialog>
    </template>
  </WidgetWrapper>
</template>

<script lang="ts" setup>
import { loadTransactions } from '@/api/transactions';
import type { DashboardWidgetConfig } from '@/api/user-settings';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipHeader,
  ChartTooltipRow,
} from '@/components/common/charts/chart-tooltip';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import FitAmount from '@/components/common/fit-amount.vue';
import { Button } from '@/components/lib/ui/button';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { useFormatCurrency } from '@/composable';
import { getChartColors } from '@/composable/charts/chart-colors';
import { formatAxisCurrency } from '@/composable/charts/format-axis-currency';
import { useHorizontalTabSwipe } from '@/composable/use-horizontal-tab-swipe';
import { PillTabs } from '@/components/lib/ui/pill-tabs';
import { useChartTooltipPosition } from '@/composable/charts/use-chart-tooltip-position';
import {
  SPIKE_DEFAULTS,
  type SpikeDetectionOptions,
  type SpikePoint,
  useSpikeDetection,
} from '@/composable/charts/use-spike-detection';
import { useAnimatedNumber } from '@/composable/use-animated-number';
import { useDateLocale } from '@/composable/use-date-locale';
import { currentTheme } from '@/common/utils/color-theme';
import { compareBalancePeriods } from './compare-balance-periods';
import { ROUTES_NAMES } from '@/routes/constants';
import { loadCombinedBalanceTrendData } from '@/services/stats';
import { useAccountsStore, useCurrenciesStore, useUserStore } from '@/stores';
import { SORT_DIRECTIONS } from '@bt/shared/types';
import { useQuery } from '@tanstack/vue-query';
import { useLocalStorage, usePreferredReducedMotion, useResizeObserver } from '@vueuse/core';
import * as d3 from 'd3';
import { differenceInDays, endOfDay, format, min, startOfDay, subDays, parseISO } from 'date-fns';
import { ChartLineIcon, ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  useId,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { selectProjectedTotalAccounts, usePlannedDateLabel } from '@/composable/use-projected-balance';

import { formatBalanceDelta, formatBalanceDeltaPercent, shouldDisplayBalanceDelta } from './balance-trend-delta';
import { type BalanceProjection, buildBalanceProjection } from './balance-trend-projection';
import BalanceTrendSettingsPopover from './components/balance-trend-settings-popover.vue';
import { readIncludePlanned } from './use-include-planned-config';
import EmptyState from './components/empty-state.vue';
import WidgetUnavailable from './components/widget-unavailable.vue';
import LoadingState from './components/loading-state.vue';
import SpikeTransactionsPanel from './components/spike-transactions-panel.vue';
import WidgetWrapper from './components/widget-wrapper.vue';
import { type NetWorthComponentBalances, type NetWorthIncludeSettings, composeNetWorth } from './net-worth-composition';

// Calculate it manually so chart will always have first and last ticks (dates)
function generateDateSteps({
  datesToShow = 5,
  fromDate,
  toDate,
}: {
  datesToShow?: number;
  fromDate: Date;
  toDate: Date;
}) {
  const start = startOfDay(fromDate).getTime();
  const end = startOfDay(toDate).getTime();
  const duration = end - start;
  const dates = [start];

  for (let i = 1; i < datesToShow - 1; i++) {
    const nextDate = start + (duration * i) / (datesToShow - 1);
    dates.push(Math.floor(nextDate));
  }

  dates.push(end);

  return dates;
}

defineOptions({
  name: 'balance-trend-widget',
});

const props = defineProps<{
  selectedPeriod: { from: Date; to: Date };
}>();

const { t, locale } = useI18n();
const { format: formatDate } = useDateLocale();
const CHART_WINDOW_POINTS = 31;
const SPIKE_TAP_MOVE_LIMIT = 10;
const TOUCH_TOOLTIP_LINGER_MS = 320;

type BalanceTypeValue = 'total' | 'accounts' | 'portfolios' | 'ventures' | 'vehicles' | 'loans';
type BalanceTypeOption = { value: BalanceTypeValue; label: string };

const selectedBalanceType = ref<BalanceTypeOption>({
  value: 'total',
  label: t('dashboard.widgets.balanceTrend.balanceTypes.total'),
});
const { formatBaseCurrency, getCurrencySymbol } = useFormatCurrency();
const { baseCurrency } = storeToRefs(useCurrenciesStore());
const { accounts } = storeToRefs(useAccountsStore());

// --- Spike settings (read from persisted dashboard widget config) ---
const widgetConfigRef = inject<Ref<DashboardWidgetConfig> | null>('dashboard-widget-config', null);

const spikeSettings = computed<SpikeDetectionOptions>(() => {
  const cfg = widgetConfigRef?.value?.config;
  return {
    enabled: (cfg?.spikesEnabled as boolean) ?? SPIKE_DEFAULTS.enabled,
    percentThreshold: (cfg?.spikePercentThreshold as number) ?? SPIKE_DEFAULTS.percentThreshold,
    absoluteThreshold: (cfg?.spikeAbsoluteThreshold as number) ?? SPIKE_DEFAULTS.absoluteThreshold,
    maxSpikes: (cfg?.spikeMaxCount as number) ?? SPIKE_DEFAULTS.maxSpikes,
  };
});

// When true, the chart x-axis is trimmed to the most recent data point.
// When false, it spans the full selected period (future dates appear empty).
const fitToLatestData = computed<boolean>(() => {
  const cfg = widgetConfigRef?.value?.config;
  return (cfg?.fitToLatestData as boolean | undefined) ?? true;
});

// User-controlled toggles for what counts toward the "Total" balance line.
// Default true so behavior matches pre-toggle releases (no migration needed).
// Affects the "total" chart line + tooltip total + headline number only; the
// per-component balance types (vehicles, ventures, loans) in the dropdown stay
// unaffected so users can still drill into them directly.
const includeVehiclesInTotal = computed<boolean>(() => {
  const cfg = widgetConfigRef?.value?.config;
  return (cfg?.includeVehiclesInTotal as boolean | undefined) ?? true;
});
const includeVenturesInTotal = computed<boolean>(() => {
  const cfg = widgetConfigRef?.value?.config;
  return (cfg?.includeVenturesInTotal as boolean | undefined) ?? true;
});
const includeLoansInTotal = computed<boolean>(() => {
  const cfg = widgetConfigRef?.value?.config;
  return (cfg?.includeLoansInTotal as boolean | undefined) ?? true;
});

const compositionSettings = computed<NetWorthIncludeSettings>(() => ({
  includeVentures: includeVenturesInTotal.value,
  includeVehicles: includeVehiclesInTotal.value,
  includeLoans: includeLoansInTotal.value,
}));
const includePlanned = computed<boolean>(() => readIncludePlanned({ config: widgetConfigRef?.value?.config }));

const getEffectiveTotal = (point: NetWorthComponentBalances): number =>
  composeNetWorth({ point, settings: compositionSettings.value });

const containerRef = ref<HTMLDivElement | null>(null);
const miniContainer = ref<HTMLDivElement | null>(null);
const inspectedDate = ref<number | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const tooltipRef = ref<HTMLDivElement | null>(null);

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  date: '',
  accountsBalance: 0,
  portfoliosBalance: 0,
  venturesBalance: 0,
  vehiclesBalance: 0,
  loansBalance: 0,
  totalBalance: 0,
  // Point-over-point change of each component, so the tooltip can show which
  // portion of net worth actually moved between the hovered day and the prior one.
  accountsDelta: 0,
  portfoliosDelta: 0,
  venturesDelta: 0,
  vehiclesDelta: 0,
  loansDelta: 0,
  // Change of the currently-charted line (matches the selected balance type).
  deltaAbsolute: null as number | null,
  deltaPercent: null as number | null,
});

const { updateTooltipPosition } = useChartTooltipPosition({
  containerRef: computed(() => (showDetails.value ? containerRef.value : miniContainer.value)),
  tooltipRef,
  tooltip,
  strategy: 'fixed',
});

// We store actual and prev period separately, so when new data is loading, we
// can still show the old period, to avoid UI flickering
const actualDataPeriod = ref(props.selectedPeriod);
const prevDataPeriod = ref(props.selectedPeriod);
// Include both from and to in query key to ensure cache invalidation when period changes
const periodQueryKey = computed(() => `${props.selectedPeriod.from.getTime()}-${props.selectedPeriod.to.getTime()}`);

// For data fetching, cap the 'to' date at today - we can't have balance history
// for future dates. The chart x-axis end is controlled separately by `chartXAxisEnd`.
const fetchPeriod = computed(() => ({
  from: props.selectedPeriod.from,
  to: min([props.selectedPeriod.to, new Date()]),
}));

const {
  data: balanceHistory,
  isFetching: isBalanceHistoryFetching,
  isError: balanceHistoryError,
  refetch: refetchBalanceHistory,
} = useQuery({
  queryKey: [...VUE_QUERY_CACHE_KEYS.widgetBalanceTrend, periodQueryKey],
  queryFn: () => loadCombinedBalanceTrendData(fetchPeriod.value),
  staleTime: Infinity,
  placeholderData: (prevData) => prevData,
});

// Fetch the previous period's balance to compare against
// The previous period has the same duration and ends right before the current period starts
const prevPeriod = computed(() => {
  const durationInDays = differenceInDays(props.selectedPeriod.to, props.selectedPeriod.from) + 1;
  const prevTo = subDays(props.selectedPeriod.from, 1); // Day before current period starts
  const prevFrom = subDays(props.selectedPeriod.from, durationInDays);

  return {
    from: prevFrom,
    to: min([prevTo, new Date()]),
  };
});

const { data: prevPeriodBalance, isFetching: isPrevPeriodBalanceFetching } = useQuery({
  queryKey: [...VUE_QUERY_CACHE_KEYS.widgetBalanceTrendPrev, periodQueryKey],
  queryFn: () => loadCombinedBalanceTrendData(prevPeriod.value),
  staleTime: Infinity,
  placeholderData: (prevData) => prevData,
});

const isWidgetDataFetching = computed(() => isBalanceHistoryFetching.value || isPrevPeriodBalanceFetching.value);
// Only show full loading state on initial load (when we have no data to display)
const isInitialLoading = computed(() => isWidgetDataFetching.value && !balanceHistory.value);

// On each "selectedPeriod" change we immediately set it as "actualDataPeriod"
// but if "isWidgetDataFetching" is also triggered, means we started loading new
// data, then we need to actually reassing "actualDataPeriod" to be as "prevDataPeriod",
// so there won't be any data flickering. Once data is fully loaded, we assign
// actual values to both of them
watch(
  () => props.selectedPeriod,
  (value) => {
    actualDataPeriod.value = value;
  },
);
watch(
  isWidgetDataFetching,
  (value) => {
    if (value) {
      actualDataPeriod.value = prevDataPeriod.value;
    } else {
      actualDataPeriod.value = props.selectedPeriod;
      prevDataPeriod.value = props.selectedPeriod;
    }
  },
  { immediate: true },
);

const isDataEmpty = computed(() => !balanceHistory.value?.length);

// True when the user has any venture activity reflected in the loaded series.
// Gates the venture tooltip row and the venture option in the balance-type
// selector — both must stay hidden for users with no venture deals.
const hasVentureData = computed(
  () => !!balanceHistory.value && balanceHistory.value.some((i) => i.venturesBalance !== 0),
);

// Same gating for vehicles — most users don't have any, so the option only
// surfaces once a vehicle account exists.
const hasVehicleData = computed(
  () => !!balanceHistory.value && balanceHistory.value.some((i) => i.vehiclesBalance !== 0),
);

// Same gating for loans; balances are negative, so check `!== 0` (not `> 0`) to detect any active loan.
const hasLoanData = computed(() => !!balanceHistory.value && balanceHistory.value.some((i) => i.loansBalance !== 0));

// Tooltip rows for vehicles/ventures/loans show when the component contributes
// to what the user is currently viewing — either it's flowing into the Total
// (and Total is the selected line), or the user explicitly picked that
// component's line from the dropdown. Hidden when toggled out of Total to
// avoid showing a value that doesn't add up to the displayed Total.
const showVehiclesRow = computed(() => {
  if (!hasVehicleData.value) return false;
  if (selectedBalanceType.value.value === 'vehicles') return true;
  return includeVehiclesInTotal.value;
});
const showVenturesRow = computed(() => {
  if (!hasVentureData.value) return false;
  if (selectedBalanceType.value.value === 'ventures') return true;
  return includeVenturesInTotal.value;
});
const showLoansRow = computed(() => {
  if (!hasLoanData.value) return false;
  if (selectedBalanceType.value.value === 'loans') return true;
  return includeLoansInTotal.value;
});

const tooltipCurrency = computed(() => baseCurrency.value?.currency?.code);
const deltaColorClass = (delta: number) => ({
  'text-success-text': delta > 0,
  'text-app-expense-color': delta < 0,
  'text-card-tooltip-muted': delta === 0,
});

// Component breakdown shown in the tooltip, gated the same way as the standalone
// row flags so the visible deltas always sum to the displayed Total.
const tooltipComponentRows = computed(() =>
  selectedBalanceType.value.value !== 'total'
    ? []
    : [
        {
          key: 'accounts',
          label: t('dashboard.widgets.balanceTrend.tooltip.accounts'),
          value: tooltip.accountsBalance,
          delta: tooltip.accountsDelta,
          show: true,
        },
        {
          key: 'portfolios',
          label: t('dashboard.widgets.balanceTrend.tooltip.portfolios'),
          value: tooltip.portfoliosBalance,
          delta: tooltip.portfoliosDelta,
          show: true,
        },
        {
          key: 'ventures',
          label: t('dashboard.widgets.balanceTrend.tooltip.ventures'),
          value: tooltip.venturesBalance,
          delta: tooltip.venturesDelta,
          show: showVenturesRow.value,
        },
        {
          key: 'vehicles',
          label: t('dashboard.widgets.balanceTrend.tooltip.vehicles'),
          value: tooltip.vehiclesBalance,
          delta: tooltip.vehiclesDelta,
          show: showVehiclesRow.value,
        },
        {
          key: 'loans',
          label: t('dashboard.widgets.balanceTrend.tooltip.loans'),
          value: tooltip.loansBalance,
          delta: tooltip.loansDelta,
          show: showLoansRow.value,
        },
      ].filter((row) => row.show),
);

const balanceTypeOptions = computed<BalanceTypeOption[]>(() => {
  const options: BalanceTypeOption[] = [
    { value: 'total', label: t('dashboard.widgets.balanceTrend.balanceTypes.total') },
    { value: 'accounts', label: t('dashboard.widgets.balanceTrend.balanceTypes.accounts') },
    { value: 'portfolios', label: t('dashboard.widgets.balanceTrend.balanceTypes.portfolios') },
  ];
  if (hasVentureData.value) {
    options.push({ value: 'ventures', label: t('dashboard.widgets.balanceTrend.balanceTypes.ventures') });
  }
  if (hasVehicleData.value) {
    options.push({ value: 'vehicles', label: t('dashboard.widgets.balanceTrend.balanceTypes.vehicles') });
  }
  if (hasLoanData.value) {
    options.push({ value: 'loans', label: t('dashboard.widgets.balanceTrend.balanceTypes.loans') });
  }
  return options;
});

// Roll the user off the ventures/vehicles/loans views if the underlying data
// disappears (last deal/vehicle/loan deleted while widget mounted) — otherwise
// the select would display a stale label after the option vanishes from the list.
watch(hasVentureData, (val) => {
  if (!val && selectedBalanceType.value.value === 'ventures') {
    selectedBalanceType.value = balanceTypeOptions.value[0]!;
  }
});
watch(hasVehicleData, (val) => {
  if (!val && selectedBalanceType.value.value === 'vehicles') {
    selectedBalanceType.value = balanceTypeOptions.value[0]!;
  }
});
watch(hasLoanData, (val) => {
  if (!val && selectedBalanceType.value.value === 'loans') {
    selectedBalanceType.value = balanceTypeOptions.value[0]!;
  }
});

const showDetails = ref(false);
const user = useUserStore();
const preferredBalanceType = useLocalStorage(
  computed(() => `dashboard-balance-type:${user.user?.id ?? 'anonymous'}`),
  'total',
);
watch(
  [balanceTypeOptions, preferredBalanceType],
  ([options, preferred]) => {
    const option = options.find(({ value }) => value === preferred) ?? options[0];
    if (option && selectedBalanceType.value.value !== option.value) selectedBalanceType.value = option;
  },
  { immediate: true },
);
function selectBalanceType(option: BalanceTypeOption | null) {
  if (!option) return;
  selectedBalanceType.value = option;
  preferredBalanceType.value = option.value;
}
const selectBalanceTypeValue = (value: string) => {
  const option = balanceTypeOptions.value.find((item) => item.value === value);
  if (option) selectBalanceType(option);
};
const balanceSwipe = useHorizontalTabSwipe({
  current: computed(() => selectedBalanceType.value.value),
  values: () => balanceTypeOptions.value.map(({ value }) => value),
  select: selectBalanceTypeValue,
});

const usesLoanBalance = computed(() => selectedBalanceType.value.value === 'loans');
const metricLabel = computed(() =>
  t(`dashboard.widgets.balanceTrend.presentation.metrics.${selectedBalanceType.value.value}.label`),
);
const metricDescription = computed(() =>
  t(`dashboard.widgets.balanceTrend.presentation.metrics.${selectedBalanceType.value.value}.description`),
);
const periodLabel = computed(() => {
  const latest = chartData.value.at(-1)?.date;
  if (latest === undefined) return '';
  const date = new Date(latest);
  if (date.getTime() === startOfDay(new Date()).getTime()) return t('dashboard.widgets.balanceTrend.today');
  return t('dashboard.widgets.balanceTrend.presentation.asOf', {
    date: date.toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }),
  });
});

// Chart data based on selected balance type
const chartData = computed(() => {
  if (!balanceHistory.value) return [];

  return balanceHistory.value
    .map((point) => {
      const effectiveTotal = getEffectiveTotal(point);

      let value: number;
      switch (selectedBalanceType.value.value) {
        case 'accounts':
          value = point.accountsBalance;
          break;
        case 'portfolios':
          value = point.portfoliosBalance;
          break;
        case 'ventures':
          value = point.venturesBalance;
          break;
        case 'vehicles':
          value = point.vehiclesBalance;
          break;
        case 'loans':
          value = -point.loansBalance;
          break;
        default:
          value = effectiveTotal;
      }

      return {
        date: startOfDay(parseISO(point.date)).getTime(),
        value,
        accountsBalance: point.accountsBalance,
        portfoliosBalance: point.portfoliosBalance,
        venturesBalance: point.venturesBalance,
        vehiclesBalance: point.vehiclesBalance,
        loansBalance: point.loansBalance,
        totalBalance: effectiveTotal,
      };
    })
    .filter(({ date, value }) => Number.isFinite(date) && Number.isFinite(value));
});
type ChartPoint = (typeof chartData.value)[number];
const pointIndices = computed(() => new Map(chartData.value.map(({ date }, index) => [date, index])));
const nearestPointIndex = d3.bisector<ChartPoint, number>(({ date }) => date).center;
const miniTrend = computed(() => {
  const points = chartData.value;
  if (!points.length) return null;
  const first = points[0]!;
  const last = points.at(-1)!;
  const [low = 0, high = 0] = d3.extent(points, ({ value }) => value);
  const scaleX = d3.scaleLinear().domain([first.date, last.date]).range([4, 296]);
  const scaleY = d3.scaleLinear().domain([low, high]).range([42, 6]);
  return {
    x: scaleX,
    y: scaleY,
    pointCount: points.length,
    area:
      d3
        .area<(typeof points)[number]>()
        .x(({ date }) => scaleX(date))
        .y0(44)
        .y1(({ value }) => scaleY(value))(points) ?? '',
    path:
      d3
        .line<(typeof points)[number]>()
        .x(({ date }) => scaleX(date))
        .y(({ value }) => scaleY(value))(points) ?? '',
    end: { x: scaleX(last.date), y: scaleY(last.value) },
  };
});
const summaryStats = computed(() => {
  const first = chartData.value[0];
  const last = chartData.value.at(-1);
  if (!first || !last || first.date === last.date) return undefined;
  return { start: first.value, change: last.value - first.value };
});
const chartWindowStart = ref<number | null>(null);
const lastChartWindowStart = computed(() => Math.max(0, chartData.value.length - CHART_WINDOW_POINTS));
const canPanChart = computed(() => lastChartWindowStart.value > 0);
const chartWindow = computed(() => {
  if (!canPanChart.value || chartWindowStart.value === null) return null;
  const start = Math.min(chartWindowStart.value, lastChartWindowStart.value);
  return chartData.value.slice(start, start + CHART_WINDOW_POINTS);
});

watch(
  () => [props.selectedPeriod.from.getTime(), props.selectedPeriod.to.getTime(), selectedBalanceType.value.value],
  () => {
    resetChartWindow();
  },
);

const moveChartWindow = ({ points }: { points: number }) => {
  if (!canPanChart.value) return;
  const lastStart = lastChartWindowStart.value;
  const start = chartWindowStart.value;
  hidePoint();
  inspectedDate.value = null;
  chartWindowStart.value =
    start === null ? (points < 0 ? lastStart : 0) : Math.max(0, Math.min(lastStart, start + points));
};

const resetChartWindow = () => {
  hidePoint();
  inspectedDate.value = null;
  chartWindowStart.value = null;
};

let chartPointer: { id: number; x: number; y: number } | null = null;
let ignoreChartClick = false;
let chartTooltipTimer: ReturnType<typeof setTimeout> | undefined;
let pointSelectedFromTable = false;
let clearChartHover = () => {};
let showChartHover: ((point: ChartPoint) => DOMPoint | null) | undefined;

const stopTooltipTimer = () => {
  clearTimeout(chartTooltipTimer);
  chartTooltipTimer = undefined;
};

function hidePoint({ preserveSelection = false }: { preserveSelection?: boolean } = {}) {
  stopTooltipTimer();
  cancelAnimationFrame(chartHoverFrame);
  tooltip.visible = false;
  if (preserveSelection && pointSelectedFromTable) return;
  pointSelectedFromTable = false;
  clearChartHover();
}

const finishTooltipPointer = (event: PointerEvent) => {
  if (!event.isPrimary || event.pointerType === 'mouse') return;
  stopTooltipTimer();
  chartTooltipTimer = setTimeout(() => hidePoint(), TOUCH_TOOLTIP_LINGER_MS);
};

const leaveChart = (event: PointerEvent) => {
  if (event.pointerType === 'mouse') {
    hidePoint({ preserveSelection: true });
  } else if (chartTooltipTimer === undefined) {
    finishTooltipPointer(event);
  }
};

const rememberChartPointer = (event: PointerEvent) => {
  if (!event.isPrimary || event.button !== 0) return;
  chartPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  ignoreChartClick = false;
};
const finishChartPointer = (event: PointerEvent) => {
  if (chartPointer?.id !== event.pointerId) return;
  finishTooltipPointer(event);
  // A drag may start on an enlarged spike hit target. Only taps and clicks open it.
  ignoreChartClick = Math.hypot(event.clientX - chartPointer.x, event.clientY - chartPointer.y) >= SPIKE_TAP_MOVE_LIMIT;
  chartPointer = null;
};
const cancelChartPointer = () => {
  chartPointer = null;
  hidePoint();
};

const inspectPoint = ({ point, anchor }: { point: ChartPoint; anchor: { clientX: number; clientY: number } }) => {
  if (tooltip.visible && inspectedDate.value === point.date) return;
  inspectedDate.value = point.date;
  tooltip.date = formatDate(point.date, 'PP');
  tooltip.accountsBalance = point.accountsBalance;
  tooltip.portfoliosBalance = point.portfoliosBalance;
  tooltip.venturesBalance = point.venturesBalance;
  tooltip.vehiclesBalance = point.vehiclesBalance;
  tooltip.loansBalance = point.loansBalance;
  tooltip.totalBalance = point.value;

  const previous = chartData.value[(pointIndices.value.get(point.date) ?? 0) - 1];
  const diff = compareBalancePeriods({ current: point.value, previous: previous?.value });
  tooltip.deltaAbsolute = diff.absolute;
  tooltip.deltaPercent = diff.percent;
  tooltip.accountsDelta = previous ? point.accountsBalance - previous.accountsBalance : 0;
  tooltip.portfoliosDelta = previous ? point.portfoliosBalance - previous.portfoliosBalance : 0;
  tooltip.venturesDelta = previous ? point.venturesBalance - previous.venturesBalance : 0;
  tooltip.vehiclesDelta = previous ? point.vehiclesBalance - previous.vehiclesBalance : 0;
  tooltip.loansDelta = previous ? point.loansBalance - previous.loansBalance : 0;
  tooltip.visible = true;

  // Measure the new tooltip content after Vue commits it, including on the first touch.
  void nextTick(() => {
    if (tooltip.visible && inspectedDate.value === point.date) updateTooltipPosition(anchor);
  });
};

const queuePointInspection = ({ event, inspect }: { event: PointerEvent; inspect: () => void }) => {
  if (!event.isPrimary || (event.pointerType !== 'mouse' && !(event.buttons & 1))) return;
  stopTooltipTimer();
  cancelAnimationFrame(chartHoverFrame);
  chartHoverFrame = requestAnimationFrame(inspect);
};

const inspectMini = (event: PointerEvent) => {
  const host = event.currentTarget;
  if (!(host instanceof SVGSVGElement)) return;
  queuePointInspection({
    event,
    inspect: () => {
      const trend = miniTrend.value;
      const matrix = host.getScreenCTM();
      if (!trend || !matrix) return;
      const target = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const points = chartData.value;
      const point = points[nearestPointIndex(points, trend.x.invert(target.x))];
      if (!point) return;
      const anchor = new DOMPoint(trend.x(point.date), trend.y(point.value)).matrixTransform(matrix);
      inspectPoint({ point, anchor: { clientX: anchor.x, clientY: anchor.y } });
    },
  });
};

const selectTablePoint = ({ point }: { point: ChartPoint }) => {
  hidePoint();
  pointSelectedFromTable = true;
  inspectedDate.value = point.date;
  const index = pointIndices.value.get(point.date) ?? 0;
  const start = chartWindowStart.value;
  if (start !== null && (index < start || index >= start + CHART_WINDOW_POINTS)) {
    chartWindowStart.value = Math.min(
      lastChartWindowStart.value,
      Math.max(0, index - Math.floor(CHART_WINDOW_POINTS / 2)),
    );
    return;
  }
  showChartHover?.(point);
};
const protectChartPan = (event: MouseEvent) => {
  if (!ignoreChartClick) return;
  ignoreChartClick = false;
  event.stopPropagation();
};

// Keep the alternative data view compact even for multi-year daily series.
const chartTableRows = computed(() => {
  const rows = chartData.value;
  if (rows.length <= 12) return rows;
  const lastIndex = rows.length - 1;
  const sample = Array.from({ length: 12 }, (_, i) => rows[Math.round((i * lastIndex) / 11)]!);
  const current = inspectedDate.value;
  const point =
    current === null || sample.some(({ date }) => date === current)
      ? undefined
      : rows.find(({ date }) => date === current);
  return point ? [...sample, point].sort((left, right) => left.date - right.date) : sample;
});

const { spikePoints } = useSpikeDetection({ chartData, options: spikeSettings });

// Plans only ever sit on money accounts, so the projection continues the accounts line
// and the total line; the other balance types have nothing pending to add.
const isProjectionEligible = computed(
  () => selectedBalanceType.value.value === 'total' || selectedBalanceType.value.value === 'accounts',
);
const isPeriodEndCurrentOrFuture = computed(
  () => startOfDay(props.selectedPeriod.to).getTime() >= startOfDay(new Date()).getTime(),
);

// The widget previews where the period lands, not every plan, so it reads a bounded slice.
// The endpoint orders by time DESC by default; ascending order is what makes the truncated
// slice the nearest plans instead of the furthest-out ones.
const PENDING_PLANS_LIMIT = 30;

const { data: pendingPlans } = useQuery({
  queryKey: [...VUE_QUERY_CACHE_KEYS.widgetBalanceTrendPlanned, periodQueryKey, includePlanned],
  queryFn: () =>
    loadTransactions({
      isPlanned: true,
      offset: 0,
      limit: PENDING_PLANS_LIMIT,
      order: SORT_DIRECTIONS.asc,
      to: endOfDay(props.selectedPeriod.to).toISOString(),
    }),
  staleTime: Infinity,
  placeholderData: (prevData) => prevData,
  enabled: computed(() => includePlanned.value && isPeriodEndCurrentOrFuture.value),
});

// The plans endpoint spans every account the user owns, archived included, while the chart's
// lines are built from the projected-total scope — a plan outside it would move the dashed
// line without ever having moved the solid one.
const projectionAccountIds = computed(
  () => new Set(selectProjectedTotalAccounts({ accounts: accounts.value ?? [] }).map((account) => account.id)),
);

const projection = computed<BalanceProjection | null>(() => {
  if (!includePlanned.value || !isProjectionEligible.value) return null;
  if (!pendingPlans.value || pendingPlans.value.length === 0) return null;

  const lastChartPoint = chartData.value[chartData.value.length - 1];
  if (!lastChartPoint) return null;

  const scopedPlans = pendingPlans.value.filter((tx) => projectionAccountIds.value.has(tx.accountId));
  if (scopedPlans.length === 0) return null;

  return buildBalanceProjection({
    lastRealPoint: { date: lastChartPoint.date, value: lastChartPoint.value },
    plans: scopedPlans.map((tx) => ({
      time: tx.time,
      refAmount: tx.refAmount,
      transactionType: tx.transactionType,
      note: tx.note,
    })),
    periodEnd: startOfDay(actualDataPeriod.value.to).getTime(),
    now: Date.now(),
  });
});

const { formatPlannedDate } = usePlannedDateLabel();
const projectionThroughDate = computed(() => formatPlannedDate({ time: projection.value?.latestPlanTime ?? null }));

// End date the chart x-axis should reach. Trimmed to today when fitToLatestData is on —
// unless a projection is drawn, whose dashed tail through the period end is itself the
// latest data the axis has to fit.
const chartXAxisEnd = computed(() => {
  if (!fitToLatestData.value || projection.value) return actualDataPeriod.value.to;
  return min([actualDataPeriod.value.to, new Date()]);
});

// Key for the chart component - changes when period changes to trigger CSS transition
const gradientId = `balance-trend-${useId()}`;

const isPortfolioMode = computed(() => selectedBalanceType.value.value === 'portfolios');

// Spike panel state
const router = useRouter();
const spikeAnchor = shallowRef<SVGCircleElement>();

const spikePanel = reactive({
  visible: false,
  spikePoint: null as SpikePoint | null,
  accountsDelta: 0,
  portfoliosDelta: 0,
  deltaPercent: null as number | null,
});

const spikeDateLabel = computed(() => {
  if (!spikePanel.spikePoint) return '';
  return formatDate(spikePanel.spikePoint.date, 'PP');
});

const selectedSpikeDate = ref<string | null>(null);

const { data: spikeTransactions, isLoading: isSpikeTransactionsLoading } = useQuery({
  queryKey: ['spike-transactions', selectedSpikeDate],
  queryFn: async () => {
    if (!selectedSpikeDate.value) return [];
    const dateStart = startOfDay(parseISO(selectedSpikeDate.value));
    const dateEnd = endOfDay(parseISO(selectedSpikeDate.value));
    const transactions = await loadTransactions({
      offset: 0,
      limit: 20,
      from: dateStart.toISOString(),
      to: dateEnd.toISOString(),
    });
    // Sort by highest refAmount (base currency) so the biggest transactions show first
    return transactions.sort((a, b) => Math.abs(b.refAmount) - Math.abs(a.refAmount));
  },
  enabled: computed(() => spikePanel.visible && selectedSpikeDate.value !== null),
  staleTime: Infinity,
});

function openSpikePanel({ marker, spike }: { marker: SVGCircleElement; spike: SpikePoint }) {
  spikeAnchor.value = marker;
  marker.setAttribute('aria-expanded', 'true');
  spikePanel.spikePoint = spike;

  // Compute per-component deltas from chartData
  const spikeIndex = pointIndices.value.get(spike.date) ?? 0;
  const priorValue = chartData.value[spikeIndex - 1]?.value;
  spikePanel.deltaPercent = compareBalancePeriods({ current: spike.value, previous: priorValue }).percent;
  if (spikeIndex > 0) {
    const curr = chartData.value[spikeIndex]!;
    const prev = chartData.value[spikeIndex - 1]!;
    spikePanel.accountsDelta = curr.accountsBalance - prev.accountsBalance;
    spikePanel.portfoliosDelta = curr.portfoliosBalance - prev.portfoliosBalance;
  } else {
    spikePanel.accountsDelta = 0;
    spikePanel.portfoliosDelta = 0;
  }

  hidePoint();
  spikePanel.visible = true;

  // Trigger transaction fetch by setting the date
  selectedSpikeDate.value = format(spike.date, 'yyyy-MM-dd');
}

function closeSpikePanel() {
  spikePanel.visible = false;
  spikeAnchor.value?.setAttribute('aria-expanded', 'false');
}

function navigateToSpikeTransactions() {
  if (!spikePanel.visible || !spikePanel.spikePoint) return;
  const dateStr = format(new Date(spikePanel.spikePoint.date), 'yyyy-MM-dd');

  closeSpikePanel();
  showDetails.value = false;
  router.push({
    name: ROUTES_NAMES.transactions,
    query: { start: dateStr, end: dateStr },
  });
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Element;
  if (!svgRef.value?.contains(target) && !miniContainer.value?.contains(target)) {
    hidePoint({ preserveSelection: true });
  }
}

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  hidePoint();
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
  clearTimeout(chartTooltipTimer);
  cancelAnimationFrame(chartRenderFrame);
  cancelAnimationFrame(chartHoverFrame);
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleEscapeKey);
});

const getColors = () => {
  const { grid, text, primary } = getChartColors();
  return { grid, text, primary };
};

const formatAxisValue = (value: number, step?: number) =>
  formatAxisCurrency({ value, symbol: getCurrencySymbol(), currencyCode: baseCurrency.value?.currency?.code, step });

let chartRenderFrame = 0;
let chartHoverFrame = 0;
const renderChart = () => {
  showChartHover = undefined;
  clearChartHover = () => {};
  if (!showDetails.value || !svgRef.value || !containerRef.value || chartData.value.length === 0) return;
  cancelAnimationFrame(chartHoverFrame);

  const points = chartWindow.value ?? chartData.value;
  const visibleProjection = chartWindow.value ? null : projection.value;
  const colors = getColors();
  const svg = d3.select(svgRef.value);
  svg.selectAll('*').remove();

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;
  const isMobile = width < 500;

  // Use the same value universe for Y-axis label width and Y-axis domain.
  // Projection can exceed historical values; otherwise its larger labels clip
  // against the left side on narrow Android viewports.
  const yValues = [...points.map((d) => d.value), ...(visibleProjection?.points.map((p) => p.value) ?? [])];
  const [dataMin = 0, dataMax = 0] = d3.extent(yValues);
  const approxTickStep = Math.max(1, (dataMax - dataMin) / 4 || 500);
  const longestLabel = Math.max(
    6,
    ...[dataMin, dataMin + approxTickStep, dataMax].map((value) => formatAxisValue(value, approxTickStep).length),
  );
  const margin = {
    top: 10,
    right: isMobile ? 46 : 40,
    bottom: 35,
    left: Math.min(Math.max(isMobile ? 56 : 64, Math.ceil(longestLabel * 6.5 + 16)), width * 0.4),
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Calculate x-axis ticks - limit to 6-7 max
  const pixelsPerTick = isMobile ? 80 : 120;
  const ticksAmount = Math.min(7, Math.max(2, Math.round(innerWidth / pixelsPerTick)));
  const fromDate = chartWindow.value ? new Date(points[0]!.date) : actualDataPeriod.value.from;
  const toDate = chartWindow.value ? new Date(points.at(-1)!.date) : chartXAxisEnd.value;
  const visibleSpikes = spikePoints.value.filter((point) => point.date >= +fromDate && point.date <= +toDate);
  const xAxisTicks = generateDateSteps({ datesToShow: ticksAmount, fromDate, toDate });

  // X scale
  const xScale = d3
    .scaleLinear()
    .domain([xAxisTicks[0]!, xAxisTicks[xAxisTicks.length - 1]!])
    .range([0, innerWidth]);

  // Y scale - limit to 5 ticks. Projected points count as data: a projection landing
  // above the real maximum must not exit the plot.
  const yMin = dataMin;
  const yMax = dataMax;
  const yPadding = (yMax - yMin) * 0.1 || 1000;
  const yScale = d3
    .scaleLinear()
    .domain([yMin - yPadding, yMax + yPadding])
    .nice(5)
    .range([innerHeight, 0]);

  // Calculate exactly 5 tick values
  const yDomain = yScale.domain();
  const yTickCount = 5;
  const yTickStep = (yDomain[1]! - yDomain[0]!) / (yTickCount - 1);
  const yTickValues = Array.from({ length: yTickCount }, (_, i) => yDomain[0]! + i * yTickStep);

  // Grid lines - exactly 5 ticks
  g.append('g')
    .attr('class', 'grid')
    .call(
      d3
        .axisLeft(yScale)
        .tickValues(yTickValues)
        .tickSize(-innerWidth)
        .tickFormat(() => ''),
    )
    .call((grid) => {
      grid.select('.domain').remove();
      grid.selectAll('.tick line').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
    });

  // Create gradient for area fill
  const defs = svg.append('defs');
  const gradient = defs
    .append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');

  gradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--primary)').attr('stop-opacity', 0.14);

  gradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--primary)').attr('stop-opacity', 0);

  // Area generator
  const area = d3
    .area<(typeof chartData.value)[0]>()
    .x((d) => xScale(d.date))
    .y0(innerHeight)
    .y1((d) => yScale(d.value))
    .curve(d3.curveMonotoneX);

  // Line generator
  const line = d3
    .line<(typeof chartData.value)[0]>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.value))
    .curve(d3.curveMonotoneX);

  // A constant balance is a line, not a large filled rectangle. Avoid
  // implying volatility when the data has not actually moved.
  const hasMovement = points.some((point) => point.value !== points[0]?.value);
  if (hasMovement) {
    g.append('path').datum(points).attr('class', 'area').attr('fill', `url(#${gradientId})`).attr('d', area);
  }

  // Draw line
  g.append('path')
    .datum(points)
    .attr('class', 'line')
    .attr('fill', 'none')
    .attr('stroke', 'var(--primary)')
    .attr('stroke-width', 2.5)
    .attr('d', line);

  const latestRealPoint = points.at(-1);
  if (latestRealPoint) {
    g.append('circle')
      .attr('cx', xScale(latestRealPoint.date))
      .attr('cy', yScale(latestRealPoint.value))
      .attr('r', isMobile ? 4 : 5)
      .attr('fill', 'var(--primary)')
      .attr('stroke', 'var(--card)')
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none');
  }

  // X axis with tick indicators
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickValues(xAxisTicks)
        .tickSize(6)
        .tickFormat((d) => {
          const date = new Date(d as number);
          return date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
        }),
    )
    .call((axis) => {
      axis.select('.domain').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
      axis.selectAll('.tick line').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
      axis.selectAll('.tick text').attr('fill', colors.text).attr('font-size', '11px').attr('dy', '1em');
    });

  // Y axis - exactly 5 ticks using same values as grid
  g.append('g')
    .attr('class', 'y-axis')
    .call(
      d3
        .axisLeft(yScale)
        .tickValues(yTickValues)
        .tickFormat((d) => formatAxisValue(d as number, yTickStep)),
    )
    .call((axis) => {
      axis.select('.domain').remove();
      axis.selectAll('.tick line').remove();
      axis.selectAll('.tick text').attr('fill', colors.text).attr('font-size', '11px').attr('dx', '-0.3em');
    });

  const hoverGuide = g.append('g').attr('pointer-events', 'none').attr('visibility', 'hidden');
  const hoverLine = hoverGuide
    .append('line')
    .attr('class', 'hover-line')
    .attr('stroke', 'var(--primary)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('stroke-opacity', 0.5)
    .attr('y1', 0)
    .attr('y2', innerHeight);
  const hoverDot = hoverGuide
    .append('circle')
    .attr('class', 'hover-dot')
    .attr('r', 5)
    .attr('fill', 'var(--primary)')
    .attr('stroke', 'var(--card)')
    .attr('stroke-width', 2);

  clearChartHover = () => hoverGuide.attr('visibility', 'hidden');
  showChartHover = (point) => {
    const x = xScale(point.date);
    const y = yScale(point.value);
    hoverDot.attr('cx', x).attr('cy', y);
    hoverLine.attr('x1', x).attr('x2', x);
    hoverGuide.attr('visibility', 'visible');
    const matrix = g.node()?.getScreenCTM();
    return matrix ? new DOMPoint(x, y).matrixTransform(matrix) : null;
  };
  if (inspectedDate.value !== null && (pointSelectedFromTable || tooltip.visible)) {
    const point = points.find(({ date }) => date === inspectedDate.value);
    if (point) showChartHover(point);
  }

  const plot = g.node()!;
  g.append('rect')
    .attr('class', 'overlay')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'crosshair');

  g.on('pointermove pointerdown', (event: PointerEvent) => {
    queuePointInspection({
      event,
      inspect: () => {
        const [x, y] = d3.pointer(event, plot);
        if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) {
          hidePoint({ preserveSelection: true });
          return;
        }

        const point = points[nearestPointIndex(points, xScale.invert(x))];
        if (!point || (tooltip.visible && inspectedDate.value === point.date)) return;
        pointSelectedFromTable = false;
        const anchor = showChartHover?.(point);
        if (anchor) inspectPoint({ point, anchor: { clientX: anchor.x, clientY: anchor.y } });
      },
    });
  });

  // Spike markers — appended after overlay so they sit on top in SVG z-order
  const markerRadius = isMobile ? 5 : 6;
  const hitAreaRadius = markerRadius + 12;
  const markers = g.append('g').attr('class', 'spike-markers');

  // Invisible hit areas (larger click target)
  markers
    .selectAll<SVGCircleElement, SpikePoint>('.spike-hit-area')
    .data(visibleSpikes)
    .join('circle')
    .attr('class', 'spike-hit-area')
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yScale(d.value))
    .attr('r', hitAreaRadius)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-haspopup', 'dialog')
    .attr('aria-expanded', (d) => String(spikePanel.visible && spikePanel.spikePoint?.date === d.date))
    .attr(
      'aria-label',
      (d) =>
        `${t('dashboard.widgets.balanceTrend.title')}, ${formatDate(d.date, 'PP')}, ${formatBaseCurrency(d.deltaAbsolute)}`,
    )
    .each(function (spike) {
      if (spikePanel.visible && spikePanel.spikePoint?.date === spike.date) spikeAnchor.value = this;
    })
    .on('click', function (event: MouseEvent, spike) {
      event.stopPropagation();
      openSpikePanel({ marker: this, spike });
    })
    .on('keydown', function (event: KeyboardEvent, spike) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openSpikePanel({ marker: this, spike });
    });

  // Visible markers
  markers
    .selectAll('.spike-dot')
    .data(visibleSpikes)
    .join('circle')
    .attr('class', 'spike-dot')
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yScale(d.value))
    .attr('r', markerRadius)
    .attr('fill', (d) =>
      d.isPositive !== usesLoanBalance.value ? 'var(--color-app-income-color)' : 'var(--color-app-expense-color)',
    )
    .attr('stroke', 'var(--card)')
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer')
    .attr('pointer-events', 'none')
    .style('filter', 'drop-shadow(0 0 3px rgba(0,0,0,0.3))');

  // Projected continuation: dashed step-line from the last real point, one hollow dot
  // per plan date, holding the final level to the period end.
  if (visibleProjection) {
    const projectionGroup = g.append('g').attr('class', 'projection');

    const todayTs = startOfDay(new Date()).getTime();
    const [domainStart, domainEnd] = xScale.domain() as [number, number];
    if (todayTs >= domainStart && todayTs < domainEnd) {
      projectionGroup
        .append('line')
        .attr('x1', xScale(todayTs))
        .attr('x2', xScale(todayTs))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', colors.grid)
        .attr('stroke-opacity', 0.6)
        .attr('stroke-dasharray', '2,3');
    }

    const projectionLine = d3
      .line<{ date: number; value: number }>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(d3.curveStepAfter);

    projectionGroup
      .append('path')
      .datum(visibleProjection.points)
      .attr('fill', 'none')
      .attr('stroke', 'var(--primary)')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.85)
      .attr('stroke-dasharray', '5,4')
      .attr('d', projectionLine);

    projectionGroup
      .selectAll('.projection-dot')
      .data(visibleProjection.steps)
      .join('circle')
      .attr('class', 'projection-dot')
      .attr('cx', (d) => xScale(d.date))
      .attr('cy', (d) => yScale(d.value))
      .attr('r', 3.5)
      .attr('fill', 'var(--card)')
      .attr('stroke', 'var(--primary)')
      .attr('stroke-width', 1.5)
      .append('title')
      .text((d) =>
        d.planLabels
          .map((plan) => {
            const amount =
              plan.refDelta > 0 ? `+${formatBaseCurrency(plan.refDelta)}` : formatBaseCurrency(plan.refDelta);
            return plan.note ? `${amount} · ${plan.note}` : amount;
          })
          .join('\n'),
      );
  }
  hoverGuide.raise();
};

const displayBalance = computed(() => {
  if (!balanceHistory.value || balanceHistory.value.length === 0) return { current: 0, previous: 0 };

  // Get the latest balance entry from current period
  const latestEntry = balanceHistory.value[balanceHistory.value.length - 1]!;

  // Get the latest (ending) balance from previous period for comparison
  const prevPeriodLastEntry =
    prevPeriodBalance.value && prevPeriodBalance.value.length > 0
      ? prevPeriodBalance.value[prevPeriodBalance.value.length - 1]
      : null;

  switch (selectedBalanceType.value!.value) {
    case 'accounts':
      return {
        current: latestEntry.accountsBalance || 0,
        previous: prevPeriodLastEntry?.accountsBalance || 0,
      };
    case 'portfolios':
      return {
        current: latestEntry.portfoliosBalance || 0,
        previous: prevPeriodLastEntry?.portfoliosBalance || 0,
      };
    case 'ventures':
      return {
        current: latestEntry.venturesBalance || 0,
        previous: prevPeriodLastEntry?.venturesBalance || 0,
      };
    case 'vehicles':
      return {
        current: latestEntry.vehiclesBalance || 0,
        previous: prevPeriodLastEntry?.vehiclesBalance || 0,
      };
    case 'loans':
      return {
        current: -(latestEntry.loansBalance || 0),
        previous: -(prevPeriodLastEntry?.loansBalance || 0),
      };
    case 'total':
    default:
      return {
        current: getEffectiveTotal(latestEntry),
        previous: prevPeriodLastEntry ? getEffectiveTotal(prevPeriodLastEntry) : 0,
      };
  }
});

const { displayValue: animatedBalance } = useAnimatedNumber({
  value: computed(() => displayBalance.value.current),
});

// Missing history is not the same as a zero balance. A zero starting
// balance supports an absolute difference, but no meaningful percentage.
const balanceComparison = computed(() =>
  compareBalancePeriods({
    current: displayBalance.value.current,
    previous: prevPeriodBalance.value?.length ? displayBalance.value.previous : null,
  }),
);
const balancesDiff = computed(() => balanceComparison.value.percent);
const balancesDiffAbsolute = computed(() => balanceComparison.value.absolute);
const comparisonTone = computed(() => Math.sign(balancesDiffAbsolute.value ?? 0) * (usesLoanBalance.value ? -1 : 1));

const motion = usePreferredReducedMotion();

const scheduleChartRender = () => {
  if (chartRenderFrame) return;
  chartRenderFrame = requestAnimationFrame(() => {
    chartRenderFrame = 0;
    renderChart();
  });
};
useResizeObserver(containerRef, scheduleChartRender);
watch(
  [svgRef, chartData, actualDataPeriod, currentTheme, spikePoints, chartXAxisEnd, projection, showDetails],
  () => {
    closeSpikePanel();
    hidePoint();
    inspectedDate.value = null;
    scheduleChartRender();
  },
  { flush: 'post' },
);

watch(chartWindow, scheduleChartRender, { flush: 'post' });

const miniAnimation = shallowRef<{ path: string; area: string }>();
let miniFrame = 0;
watch(miniTrend, (next, previous) => {
  cancelAnimationFrame(miniFrame);
  const visible = miniAnimation.value ?? previous;
  miniAnimation.value = undefined;
  if (!visible || !next || next.pointCount !== previous?.pointCount || motion.value === 'reduce') return;
  const line = d3.interpolateString(visible.path, next.path);
  const area = d3.interpolateString(visible.area, next.area);
  const start = performance.now();
  const renderMiniFrame = (time: number) => {
    const progress = Math.min(1, (time - start) / 240);
    if (progress >= 1) {
      miniAnimation.value = undefined;
      return;
    }
    const step = d3.easeCubicOut(progress);
    miniAnimation.value = { path: line(step), area: area(step) };
    miniFrame = requestAnimationFrame(renderMiniFrame);
  };
  miniFrame = requestAnimationFrame(renderMiniFrame);
});
onBeforeUnmount(() => cancelAnimationFrame(miniFrame));
</script>

<style scoped>
.lajur-chart-tooltip-enter-active,
.lajur-chart-tooltip-leave-active {
  transition:
    opacity 160ms ease,
    scale 160ms ease;
}

.lajur-chart-tooltip-enter-from,
.lajur-chart-tooltip-leave-to {
  opacity: 0;
  scale: 0.98;
}

@media (prefers-reduced-motion: reduce) {
  .lajur-chart-tooltip-enter-active,
  .lajur-chart-tooltip-leave-active {
    transition: none;
  }
}
</style>
