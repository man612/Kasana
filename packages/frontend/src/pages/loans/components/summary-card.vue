<template>
  <Card class="@container/loan-summary shrink-0 gap-0">
    <CardHeader class="gap-2 px-3 py-3">
      <div class="flex min-w-0 items-start gap-3">
        <AccountLogoPicker :account-id="loan.id" class="size-10 shrink-0" />
        <div class="min-w-0 flex-1">
          <h1 class="text-xl leading-tight font-semibold tracking-tight wrap-anywhere">{{ loan.name }}</h1>
          <p class="text-muted-foreground mt-1 text-sm wrap-anywhere">
            {{ $t(`loans.types.${loan.loanDetails.loanType}`)
            }}<template v-if="loan.loanDetails.lenderName"> · {{ loan.loanDetails.lenderName }}</template>
          </p>
        </div>
      </div>

      <template v-if="!isPaidOff">
        <div
          class="border-border/65 grid min-w-0 items-start gap-3 border-t pt-3 @md/loan-summary:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
        >
          <div class="min-w-0">
            <span v-if="!isArchived" class="text-muted-foreground text-xs font-semibold">
              {{ $t('loans.detail.status.active') }}
            </span>
            <div class="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
              <span>{{ $t('loans.detail.summary.outstanding') }}</span>
              <HintIcon :content="$t('loans.detail.summary.principalOnlyTooltip')" />
            </div>
            <Transition name="kasana-page">
              <div
                :key="outstandingBalanceDisplay"
                class="text-2xl font-semibold tracking-tight wrap-anywhere tabular-nums @sm/loan-summary:text-4xl"
              >
                {{ outstandingBalanceDisplay }}
              </div>
            </Transition>
          </div>

          <div v-if="scheduledDate || nextPayment" class="grid min-w-0 gap-1">
            <div
              v-if="nextPaymentSoon && !isArchived"
              class="text-warning-text flex items-center gap-1.5 text-xs font-medium"
            >
              <CalendarClockIcon class="size-3.5 shrink-0" aria-hidden="true" />
              {{ $t('loans.detail.status.paymentSoon') }}
            </div>
            <dl class="divide-border/60 min-w-0 divide-y text-sm">
              <div v-if="scheduledDate" class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5">
                <dt class="text-muted-foreground">{{ $t('loans.list.scheduledPayment') }}</dt>
                <dd class="font-medium wrap-anywhere">{{ scheduledDate }}</dd>
              </div>
              <div v-if="nextPayment" class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5">
                <dt class="text-muted-foreground">{{ $t('loans.detail.projection.plannedPayment') }}</dt>
                <dd class="font-medium wrap-anywhere tabular-nums">{{ nextPayment }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </template>
      <SettledBanner v-else :loan="loan" />
      <div class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </CardHeader>
    <CardContent class="px-4 pb-0">
      <Button
        type="button"
        variant="ghost"
        class="border-border/65 min-h-11 w-full justify-between rounded-none border-t px-0"
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
        <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3 pb-4 text-sm wrap-anywhere">
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
import { ACCOUNT_STATUSES } from '@bt/shared/types';
import { CalendarClockIcon, ChevronDownIcon } from '@lucide/vue';
import { useFormatCurrency } from '@/composable/formatters';
import { useDateLocale } from '@/composable/use-date-locale';
import AccountLogoPicker from '@/pages/account/components/account-logo-picker.vue';

import { parseISO } from 'date-fns';
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import { outstandingAmount } from '../utils/outstanding-amount';
import { isScheduledPaymentSoon, nextScheduledPayment } from '../utils/next-scheduled-payment';
import SettledBanner from './settled-banner.vue';

const props = defineProps<{ loan: LoanApi }>();

const { formatAmountByCurrencyCode } = useFormatCurrency();
const { format: formatDate } = useDateLocale();
const { t } = useI18n();

const aprDisplay = computed(() => `${props.loan.loanDetails.interestRate.toFixed(2)}%`);

const outstandingBalanceDisplay = computed(() =>
  formatAmountByCurrencyCode(outstandingAmount({ balance: props.loan.currentBalance }), props.loan.currencyCode),
);

const paymentSchedule = computed(() => {
  const today = new Date();
  const date = nextScheduledPayment({
    day: props.loan.loanDetails.paymentDayOfMonth,
    starts: parseISO(props.loan.loanDetails.startDate),
    today,
  });
  return { date, isSoon: isScheduledPaymentSoon({ date, today }) };
});
const scheduledDate = computed(() =>
  paymentSchedule.value.date ? formatDate(paymentSchedule.value.date, 'PPP') : null,
);
const nextPaymentSoon = computed(() => paymentSchedule.value.isSoon);
const isArchived = computed(() => props.loan.status === ACCOUNT_STATUSES.archived);
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
</script>
