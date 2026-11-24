<template>
  <div class="space-y-5">
    <div>
      <div class="mb-1.5 flex items-center justify-between text-xs">
        <span class="text-muted-foreground">{{ $t('loans.detail.projection.paidLabel') }}</span>
        <span class="font-medium">{{ paidPercentDisplay }}</span>
      </div>
      <div
        class="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        :aria-label="$t('loans.detail.projection.paidLabel')"
        :aria-valuenow="progressBarWidth"
        :aria-valuetext="paidPercentDisplay"
      >
        <div
          class="bg-app-income-color h-full rounded-full motion-safe:transition-[width] motion-safe:duration-200"
          :style="{ width: `${progressBarWidth}%` }"
        />
      </div>
      <div class="text-muted-foreground mt-1.5 text-xs">
        {{
          $t('loans.detail.projection.paidOfOriginal', {
            paid: formatCurrency(loan.projection.paidToDate),
            original: formatCurrency(loan.loanDetails.originalPrincipal),
          })
        }}
      </div>
    </div>

    <div
      v-if="loan.projection.warning"
      class="text-app-expense-color bg-app-expense-color/10 rounded px-3 py-2 text-xs"
    >
      {{ $t(`loans.warnings.${loan.projection.warning}`) }}
    </div>

    <dl class="divide-border/60 border-border/60 divide-y border-t text-sm">
      <div
        v-for="{ label, value } in projectionMetrics"
        :key="label"
        class="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-baseline gap-2 py-2 wrap-anywhere"
      >
        <dt class="text-muted-foreground">{{ $t(label) }}</dt>
        <dd class="text-right font-medium tabular-nums">{{ value }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import type { LoanApi } from '@/api/loans';
import { useFormatCurrency } from '@/composable/formatters';
import { computed } from 'vue';

import { useLoanProjectionDisplay } from '../composables/use-loan-projection-display';

const props = defineProps<{ loan: LoanApi }>();

const { formatAmountByCurrencyCode } = useFormatCurrency();

const currency = computed(() => props.loan.currencyCode);

const formatCurrency = (amount: number | null) => {
  if (amount === null) return '—';
  return formatAmountByCurrencyCode(amount, currency.value);
};

const paidPercentDisplay = computed(() => `${props.loan.projection.paidToDatePercent.toFixed(1)}%`);

const { progressBarWidth, monthsRemainingDisplay, payoffDateDisplay } = useLoanProjectionDisplay({
  loan: () => props.loan,
  payoffDateFormat: 'MMM d, yyyy',
});
const projectionMetrics = computed(() => [
  { label: 'loans.detail.projection.payoffDate', value: payoffDateDisplay.value },
  { label: 'loans.detail.projection.monthsRemaining', value: monthsRemainingDisplay.value },
  {
    label: 'loans.detail.projection.totalInterestRemaining',
    value: formatCurrency(props.loan.projection.totalInterestRemaining),
  },
  { label: 'loans.detail.projection.nextMonthInterest', value: formatCurrency(props.loan.projection.monthlyInterest) },
  {
    label: 'loans.detail.projection.nextMonthPrincipal',
    value: formatCurrency(props.loan.projection.monthlyPrincipal),
  },
]);
</script>
