<template>
  <Card class="@container/loan-summary">
    <CardHeader class="px-4 pt-3 pb-2">
      <div class="flex items-start justify-between gap-3">
        <AccountLogoPicker :account-id="loan.id" class="size-10" />
        <div class="min-w-0 flex-1">
          <h1 class="text-xl leading-tight font-semibold wrap-anywhere">{{ loan.name }}</h1>
          <p class="text-muted-foreground mt-1 text-sm wrap-anywhere">
            {{ $t(`loans.types.${loan.loanDetails.loanType}`)
            }}<template v-if="loan.loanDetails.lenderName"> · {{ loan.loanDetails.lenderName }}</template>
          </p>
        </div>
        <span
          v-if="isPaidOff"
          class="bg-success/15 text-success-text shrink-0 rounded-full px-2 py-1 text-xs font-medium"
          >{{ $t('loans.detail.paidOffBadge') }}</span
        >
      </div>
    </CardHeader>
    <CardContent class="px-4 pb-3">
      <!-- Active loans lead with the outstanding balance; paid-off loans surface that in the settled
           banner instead, so the card opens straight into the details grid. -->
      <template v-if="!isPaidOff">
        <div class="text-app-expense-color text-3xl font-semibold tracking-tight wrap-anywhere tabular-nums">
          {{ outstandingBalanceDisplay }}
        </div>
        <div class="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <span>{{ $t('loans.detail.summary.outstanding') }}</span>
          <HintIcon :content="$t('loans.detail.summary.principalOnlyTooltip')" />
        </div>
        <div
          v-if="nextDueDate || loan.loanDetails.plannedPayment != null"
          class="border-border/65 mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-sm wrap-anywhere"
        >
          <div v-if="nextDueDate">
            <div class="text-muted-foreground text-xs">{{ $t('loans.list.scheduledPayment') }}</div>
            <div class="font-medium">{{ nextDueDate }}</div>
          </div>
          <div v-if="loan.loanDetails.plannedPayment != null">
            <div class="text-muted-foreground text-xs">{{ $t('loans.detail.projection.plannedPayment') }}</div>
            <div class="font-medium tabular-nums">{{ nextPayment }}</div>
          </div>
        </div>
      </template>

      <Button
        type="button"
        variant="ghost"
        class="border-border/65 mt-3 min-h-11 w-full justify-between rounded-none border-t px-0"
        :aria-expanded="showDetails"
        :aria-controls="detailsId"
        @click="showDetails = !showDetails"
      >
        {{ $t('loans.detail.detailsToggle') }}
        <ChevronDownIcon
          class="size-4 motion-safe:transition-transform motion-safe:duration-200"
          :class="showDetails && 'rotate-180'"
          aria-hidden="true"
        />
      </Button>
      <LayoutCollapse :id="detailsId" :open="showDetails">
        <div class="grid grid-cols-2 gap-4 pb-2 text-sm wrap-anywhere @sm/loan-summary:grid-cols-3">
          <div>
            <div class="text-muted-foreground text-xs">{{ $t('loans.detail.summary.apr') }}</div>
            <div class="mt-0.5 font-medium">{{ aprDisplay }}</div>
          </div>
          <div>
            <div class="text-muted-foreground text-xs">{{ $t('loans.detail.summary.originalPrincipal') }}</div>
            <div class="mt-0.5 font-medium">{{ originalPrincipalDisplay }}</div>
          </div>
          <div>
            <div class="text-muted-foreground text-xs">{{ $t('loans.detail.summary.term') }}</div>
            <div class="mt-0.5 font-medium">{{ termDisplay }}</div>
          </div>
          <div>
            <div class="text-muted-foreground text-xs">{{ $t('loans.detail.summary.startDate') }}</div>
            <div class="mt-0.5 font-medium">{{ startDateDisplay }}</div>
          </div>
          <div>
            <div class="text-muted-foreground flex items-center gap-1 text-xs">
              <span>{{ $t('loans.detail.summary.balanceAnchor') }}</span>
              <HintIcon :content="$t('loans.detail.summary.balanceAnchorTooltip')" />
            </div>
            <div class="mt-0.5 font-medium">{{ balanceAnchorDisplay }}</div>
          </div>
          <div>
            <div class="text-muted-foreground text-xs">{{ $t('loans.detail.summary.paymentDay') }}</div>
            <div class="mt-0.5 font-medium">{{ paymentDayDisplay }}</div>
          </div>
          <div v-if="loan.loanDetails.accountNumber">
            <div class="text-muted-foreground text-xs">{{ $t('loans.detail.summary.accountNumber') }}</div>
            <div class="mt-0.5 font-medium">{{ loan.loanDetails.accountNumber }}</div>
          </div>
          <template v-if="isPaidOff">
            <div>
              <div class="text-muted-foreground text-xs">{{ $t('loans.paidOff.opened') }}</div>
              <div class="mt-0.5 font-medium">{{ openedFullDisplay }}</div>
            </div>
            <div>
              <div class="text-muted-foreground text-xs">{{ $t('loans.paidOff.closed') }}</div>
              <div class="mt-0.5 font-medium">{{ closedFullDisplay }}</div>
            </div>
            <div>
              <div class="text-muted-foreground text-xs">{{ $t('loans.detail.summary.actualDuration') }}</div>
              <div class="mt-0.5 font-medium">{{ actualDurationDisplay }}</div>
            </div>
          </template>
        </div>
      </LayoutCollapse>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import HintIcon from '@/components/common/hint-icon.vue';
import type { LoanApi } from '@/api/loans';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { Button } from '@/components/lib/ui/button';
import { ChevronDownIcon } from '@lucide/vue';
import { useFormatCurrency } from '@/composable/formatters';
import { useDateLocale } from '@/composable/use-date-locale';
import AccountLogoPicker from '@/pages/account/components/account-logo-picker.vue';

import { parseISO } from 'date-fns';
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import { getLoanDurationParts, getMonthsEarly } from '../utils/paid-off-stats';
import { outstandingAmount } from '../utils/outstanding-amount';
import { nextScheduledPayment } from '../utils/next-scheduled-payment';

const props = defineProps<{ loan: LoanApi }>();

const { formatAmountByCurrencyCode } = useFormatCurrency();
const { format: formatDate } = useDateLocale();
const { t } = useI18n();

const aprDisplay = computed(() => `${props.loan.loanDetails.interestRate.toFixed(2)}%`);

const outstandingBalanceDisplay = computed(() =>
  formatAmountByCurrencyCode(outstandingAmount({ balance: props.loan.currentBalance }), props.loan.currencyCode),
);

const nextDueDate = computed(() => {
  const date = nextScheduledPayment({
    day: props.loan.loanDetails.paymentDayOfMonth,
    starts: parseISO(props.loan.loanDetails.startDate),
    today: new Date(),
  });
  return date ? formatDate(date, 'PPP') : null;
});
const nextPayment = computed(() =>
  props.loan.loanDetails.plannedPayment == null
    ? null
    : formatAmountByCurrencyCode(props.loan.loanDetails.plannedPayment, props.loan.currencyCode),
);

const originalPrincipalDisplay = computed(() =>
  formatAmountByCurrencyCode(props.loan.loanDetails.originalPrincipal, props.loan.currencyCode),
);

const termDisplay = computed(() => {
  const months = props.loan.loanDetails.termMonths;
  if (months === null) return '—';
  return t('loans.detail.summary.termMonths', { count: months }, months);
});

const startDateDisplay = computed(() => formatDate(parseISO(props.loan.loanDetails.startDate), 'MMM d, yyyy'));

const balanceAnchorDisplay = computed(() =>
  formatDate(parseISO(props.loan.loanDetails.balanceAnchorDate), 'MMM d, yyyy'),
);

const paymentDayDisplay = computed(() => {
  const day = props.loan.loanDetails.paymentDayOfMonth;
  if (day === null) return '—';
  return t('loans.detail.summary.dayOfMonth', { day });
});

const showDetails = ref(false);
const detailsId = useId();

const isPaidOff = computed(() => props.loan.projection.isPaidOff);

// Last `paid_off` event is the definitive close date (a reopen appends a newer one).
const closedDate = computed(() => {
  const paidOffEvents = props.loan.loanDetails.events.filter((event) => event.type === 'paid_off');
  const last = paidOffEvents.at(-1)?.at;
  return last ? parseISO(last) : null;
});

const openedFullDisplay = computed(() => formatDate(parseISO(props.loan.loanDetails.startDate), 'MMM d, yyyy'));
const closedFullDisplay = computed(() => (closedDate.value ? formatDate(closedDate.value, 'MMM d, yyyy') : '—'));

const actualDurationDisplay = computed(() => {
  if (!closedDate.value) return '—';
  const { totalMonths } = getLoanDurationParts({
    start: parseISO(props.loan.loanDetails.startDate),
    end: closedDate.value,
  });
  const base = t('loans.detail.summary.termMonths', { count: totalMonths }, totalMonths);
  const early = getMonthsEarly({
    startDate: parseISO(props.loan.loanDetails.startDate),
    termMonths: props.loan.loanDetails.termMonths,
    closedDate: closedDate.value,
  });
  if (early && early > 0) return `${base} · ${t('loans.detail.paidOff.monthsEarly', { count: early })}`;
  return base;
});
</script>
