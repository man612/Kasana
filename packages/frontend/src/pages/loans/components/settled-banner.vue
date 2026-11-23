<template>
  <div class="border-success/30 bg-success/10 @container/settled-banner rounded-xl border p-3 sm:p-4">
    <div
      class="flex flex-col gap-2 @lg/settled-banner:flex-row @lg/settled-banner:items-center @lg/settled-banner:justify-between"
    >
      <!-- Identity: check icon + name + type/opened/closed line. -->
      <div class="flex min-w-0 items-start gap-3">
        <CircleCheckIcon class="text-success-text mt-0.5 size-5 shrink-0" stroke-width="2" aria-hidden="true" />
        <div class="min-w-0">
          <div class="text-base leading-tight font-semibold wrap-anywhere">
            {{ $t('loans.detail.paidOff.bannerTitle', { name: loan.name }) }}
          </div>
          <div class="text-muted-foreground mt-0.5 text-sm">
            {{
              $t('loans.detail.paidOff.bannerSubline', {
                type: typeLabel,
                opened: openedDisplay,
                closed: closedDisplay,
              })
            }}
          </div>
        </div>
      </div>

      <!-- Stats: repaid / estimated interest / duration, plus an "N mo early" pill when applicable. -->
      <div
        class="border-success/20 grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] items-start gap-2 border-t pt-2 wrap-anywhere @lg/settled-banner:flex @lg/settled-banner:flex-wrap @lg/settled-banner:justify-end @lg/settled-banner:border-0 @lg/settled-banner:pt-0"
      >
        <div>
          <div class="text-muted-foreground text-xs font-medium">
            {{ $t('loans.paidOff.repaid') }}
          </div>
          <div class="mt-0.5 text-sm font-medium tabular-nums">{{ repaidDisplay }}</div>
        </div>
        <div>
          <div class="text-muted-foreground text-xs font-medium">
            {{ $t('loans.paidOff.interestPaid') }}
          </div>
          <div class="mt-0.5 text-sm font-medium tabular-nums">{{ interestDisplay }}</div>
        </div>
        <div>
          <div class="text-muted-foreground text-xs font-medium">
            {{ $t('loans.detail.paidOff.took') }}
          </div>
          <div class="mt-0.5 text-sm font-medium tabular-nums">{{ durationDisplay }}</div>
        </div>
        <span
          v-if="monthsEarly"
          class="bg-app-income-color/15 text-app-income-color inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
        >
          {{ $t('loans.detail.paidOff.monthsEarly', { count: monthsEarly }) }}
        </span>
      </div>
    </div>
  </div>
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

const typeLabel = computed(() => t(`loans.types.${props.loan.loanDetails.loanType}`));

const openedDisplay = computed(() => formatDate(startDate.value, 'MMM yyyy'));
const closedDisplay = computed(() => (closedDate.value ? formatDate(closedDate.value, 'PPP') : '—'));

const repaidDisplay = computed(() =>
  formatAmountByCurrencyCode(props.loan.loanDetails.originalPrincipal, props.loan.currencyCode),
);

const interestDisplay = computed(() => {
  const interest = props.loan.projection.estimatedInterestPaid;
  if (interest === null) return '—';
  return formatAmountByCurrencyCode(interest, props.loan.currencyCode);
});

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
