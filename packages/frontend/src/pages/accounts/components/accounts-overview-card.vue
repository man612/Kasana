<template>
  <Card>
    <div
      class="grid min-w-0 gap-3 p-4 @[40rem]/accounts-page:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @[40rem]/accounts-page:items-start @[40rem]/accounts-page:gap-6 @[40rem]/accounts-page:p-5"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-1">
          <h2 class="text-muted-foreground text-xs font-semibold">
            {{ $t('accounts.overview.totalBalance') }}
          </h2>
          <HintIcon
            :title="$t('accounts.overview.totalBalance')"
            :content="$t('accounts.overview.balanceExplanation')"
          />
        </div>
        <div
          class="text-2xl font-semibold tracking-tight wrap-anywhere tabular-nums @[40rem]/accounts-page:text-4xl"
          :class="overview.total < 0 && 'text-destructive-text'"
        >
          {{ totalDisplay }}
        </div>
        <i18n-t
          v-if="hasPendingPlans"
          keypath="accounts.overview.projected"
          :plural="planned.count"
          tag="div"
          class="text-muted-foreground mt-1 text-xs"
        >
          <template #amount
            ><span class="text-foreground font-semibold tabular-nums">{{ projectedDisplay }}</span></template
          >
          <template #count>{{ planned.count }}</template>
          <template #date>{{ latestPlannedDisplay }}</template>
        </i18n-t>
      </div>

      <dl class="border-border/65 divide-border/55 min-w-0 divide-y border-t @[40rem]/accounts-page:border-t-0">
        <div
          v-for="row in overviewRows"
          :key="row.id"
          class="grid min-h-10 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1.5 last:pb-0"
        >
          <dt class="text-muted-foreground text-sm wrap-anywhere">
            <a
              v-if="row.id === 'vehicles'"
              class="text-primary-text inline-flex min-h-8 items-center gap-1 rounded-md font-medium focus-visible:ring-2 focus-visible:outline-none"
              href="#account-vehicles"
            >
              {{ row.label }}
              <ArrowDownIcon class="size-3.5 shrink-0" aria-hidden="true" />
            </a>
            <template v-else>{{ row.label }}</template>
          </dt>
          <dd
            class="min-w-0 text-right text-sm font-semibold wrap-anywhere tabular-nums"
            :class="row.value < 0 && 'text-destructive-text'"
          >
            {{ formatBaseCurrency(row.value) }}
          </dd>
        </div>
      </dl>
    </div>
  </Card>
</template>

<script setup lang="ts">
import HintIcon from '@/components/common/hint-icon.vue';
import { useI18n } from 'vue-i18n';
import { Card } from '@/components/lib/ui/card';
import { useFormatCurrency } from '@/composable';
import { type PlannedAggregate, usePlannedDateLabel } from '@/composable/use-projected-balance';
import type { AccountsOverview } from '@/pages/accounts/accounts-overview-totals';
import { ArrowDownIcon } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps<{
  overview: AccountsOverview;
  hasVehicles: boolean;
  planned: PlannedAggregate;
  projectedTotal: number;
}>();

const { t } = useI18n();
const { formatBaseCurrency } = useFormatCurrency();
const overviewRows = computed(() => [
  { id: 'assets', label: t('accounts.overview.assets'), value: props.overview.assets },
  { id: 'liabilities', label: t('accounts.overview.liabilities'), value: props.overview.liabilities },
  ...(props.hasVehicles
    ? [{ id: 'vehicles', label: t('accounts.overview.vehicles'), value: props.overview.vehicles }]
    : []),
]);
const { formatPlannedDate } = usePlannedDateLabel();

const totalDisplay = computed(
  () => `${props.overview.isApprox ? '≈ ' : ''}${formatBaseCurrency(props.overview.total)}`,
);

const hasPendingPlans = computed(() => props.planned.count > 0);
const projectedDisplay = computed(
  () => `${props.overview.isApprox ? '≈ ' : ''}${formatBaseCurrency(props.projectedTotal)}`,
);
const latestPlannedDisplay = computed(() => formatPlannedDate({ time: props.planned.latestTime }));
</script>
