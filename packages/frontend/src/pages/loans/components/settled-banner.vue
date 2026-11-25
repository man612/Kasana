<template>
  <section class="border-success/30 bg-success/10 grid min-w-0 gap-3 rounded-lg border p-3">
    <div class="flex min-w-0 items-start gap-2">
      <CircleCheckIcon class="text-success-text mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div class="min-w-0">
        <h2 class="font-semibold">{{ $t('loans.detail.paidOffBadge') }}</h2>
        <p v-if="monthsEarly" class="text-success-text text-sm">
          {{ $t('loans.detail.paidOff.monthsEarly', { count: monthsEarly }) }}
        </p>
      </div>
    </div>
    <dl class="divide-success/20 min-w-0 divide-y">
      <div v-if="closedDate" class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
        <dt class="text-muted-foreground">{{ $t('loans.paidOff.closed') }}</dt>
        <dd class="font-medium wrap-anywhere">{{ closedDisplay }}</dd>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
        <dt class="text-muted-foreground">{{ $t('loans.paidOff.repaid') }}</dt>
        <dd class="font-semibold wrap-anywhere tabular-nums">{{ repaidDisplay }}</dd>
      </div>
      <div v-if="closedDate" class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-2 text-sm">
        <dt class="text-muted-foreground">{{ $t('loans.detail.paidOff.took') }}</dt>
        <dd class="font-medium wrap-anywhere">{{ durationDisplay }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import type { LoanApi } from '@/api/loans';
import { useFormatCurrency } from '@/composable/formatters';
import { useDateLocale } from '@/composable/use-date-locale';
import { CircleCheckIcon } from '@lucide/vue';
import { parseISO } from 'date-fns';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { getLoanDurationParts, getMonthsEarly } from '../utils/paid-off-stats';

const props = defineProps<{ loan: LoanApi }>();

const { formatAmountByCurrencyCode } = useFormatCurrency();
const { format: formatDate } = useDateLocale();
const { t } = useI18n();

const startDate = computed(() => parseISO(props.loan.loanDetails.startDate));

// The last `paid_off` event is the definitive close date (a reopen appends a newer one).
const closedDate = computed(() => {
  const paidOffEvents = props.loan.loanDetails.events.filter((event) => event.type === 'paid_off');
  const last = paidOffEvents.at(-1)?.at;
  return last ? parseISO(last) : null;
});

const closedDisplay = computed(() => (closedDate.value ? formatDate(closedDate.value, 'PPP') : '—'));

const repaidDisplay = computed(() =>
  formatAmountByCurrencyCode(props.loan.loanDetails.originalPrincipal, props.loan.currencyCode),
);

const durationParts = computed(() =>
  getLoanDurationParts({ start: startDate.value, end: closedDate.value ?? new Date() }),
);

const durationDisplay = computed(() => {
  const { years, months } = durationParts.value;
  if (years > 0 && months > 0) return t('loans.detail.paidOff.duration.full', { years, months });
  if (years > 0) return t('loans.detail.paidOff.duration.years', { years });
  return t('loans.detail.paidOff.duration.months', { months });
});

const monthsEarly = computed(() =>
  closedDate.value
    ? getMonthsEarly({
        startDate: startDate.value,
        termMonths: props.loan.loanDetails.termMonths,
        closedDate: closedDate.value,
      })
    : null,
);
</script>
