<template>
  <Popover :open="visible" @update:open="!$event && $emit('close')">
    <PopoverAnchor :reference="anchor" as="span" hidden />
    <PopoverContent
      :aria-label="spikeDate"
      align="start"
      class="w-[min(21.125rem,calc(100vw-1.5rem))] overflow-y-auto p-0"
      @close-auto-focus="restoreMarkerFocus"
    >
      <!-- Header -->
      <div class="flex items-start justify-between gap-2 border-b px-3 py-2">
        <div>
          <div class="text-sm font-medium">{{ spikeDate }}</div>
          <div
            class="text-xs font-semibold"
            :class="{
              'text-success-text': isPositive,
              'text-app-expense-color': !isPositive,
            }"
          >
            {{ formatBalanceDelta({ delta: deltaAbsolute, currency: currencyCode }) }}
            <template v-if="deltaPercent !== null">
              ({{ formatBalanceDeltaPercent({ percent: deltaPercent }) }})
            </template>
          </div>
        </div>
        <DesktopOnlyTooltip :content="$t('common.ui.close')">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            class="-mt-0.5 -mr-1 shrink-0"
            :aria-label="$t('common.ui.close')"
            @click="$emit('close')"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </DesktopOnlyTooltip>
      </div>

      <!-- Content -->
      <div class="px-3 py-2">
        <!-- Balance breakdown (total mode only) -->
        <div v-if="showBalanceBreakdown" class="mb-2 space-y-0.5 border-b pb-2 text-xs">
          <div class="flex justify-between">
            <span class="text-foreground font-semibold">{{
              $t('dashboard.widgets.balanceTrend.spikePanel.accounts')
            }}</span>
            <span
              :class="{
                'text-success-text': accountsDelta > 0,
                'text-app-expense-color': accountsDelta < 0,
                'text-muted-foreground': accountsDelta === 0,
              }"
            >
              {{ accountsDelta > 0 ? '+' : ''
              }}{{ formatLargeNumber(accountsDelta, { isFiat: true, currency: currencyCode }) }}
            </span>
          </div>
          <div class="mt-1 flex justify-between">
            <span class="text-foreground font-semibold">{{
              $t('dashboard.widgets.balanceTrend.spikePanel.portfolios')
            }}</span>
            <span
              :class="{
                'text-success-text': portfoliosDelta > 0,
                'text-app-expense-color': portfoliosDelta < 0,
                'text-muted-foreground': portfoliosDelta === 0,
              }"
            >
              {{ portfoliosDelta > 0 ? '+' : ''
              }}{{ formatLargeNumber(portfoliosDelta, { isFiat: true, currency: currencyCode }) }}
            </span>
          </div>
        </div>

        <template v-if="isPortfolioMode">
          <p class="text-muted-foreground text-xs">
            {{ $t('dashboard.widgets.balanceTrend.spikePanel.priceDrivenChange') }}
          </p>
        </template>
        <template v-else-if="isLoading">
          <div class="space-y-1">
            <TransactionRecordSkeleton v-for="i in 3" :key="i" />
          </div>
        </template>
        <template v-else-if="significantTransactions.length === 0">
          <p class="text-muted-foreground text-xs">
            {{ $t('dashboard.widgets.balanceTrend.spikePanel.noSignificantTransactions') }}
          </p>
        </template>
        <template v-else>
          <div class="space-y-1">
            <TransactionRecord v-for="tx in significantTransactions" :key="tx.id" :tx="tx" :as-button="false" />
          </div>
          <Button type="button" size="sm" variant="link" class="mt-2 w-full" @click="$emit('see-all')">
            {{ $t('dashboard.widgets.balanceTrend.spikePanel.seeAllTransactions') }}
          </Button>
        </template>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts" setup>
import { Button } from '@/components/lib/ui/button';
import { Popover, PopoverContent } from '@/components/lib/ui/popover';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import TransactionRecord from '@/components/transactions-list/transaction-record.vue';
import TransactionRecordSkeleton from '@/components/transactions-list/transaction-record-skeleton.vue';
import { formatLargeNumber } from '@/js/helpers';
import {
  TRANSACTION_TRANSFER_NATURE,
  TRANSACTION_TYPES,
  type TransactionModel,
  isTwoLegTransfer,
} from '@bt/shared/types';
import { XIcon } from '@lucide/vue';
import { PopoverAnchor } from 'reka-ui';
import { computed } from 'vue';

import { formatBalanceDelta, formatBalanceDeltaPercent } from '../balance-trend-delta';

const props = defineProps<{
  visible: boolean;
  anchor?: SVGCircleElement;
  spikeDate: string;
  deltaAbsolute: number;
  deltaPercent: number | null;
  isPositive: boolean;
  transactions: TransactionModel[];
  isLoading: boolean;
  isPortfolioMode: boolean;
  accountsDelta: number;
  portfoliosDelta: number;
  selectedBalanceType: 'total' | 'accounts' | 'portfolios' | 'ventures' | 'vehicles' | 'loans';
  currencyCode?: string;
}>();

const showBalanceBreakdown = computed(
  () => props.selectedBalanceType === 'total' && (props.accountsDelta !== 0 || props.portfoliosDelta !== 0),
);

// Show only relevant transactions:
// - exclude between-account transfers (zero-sum)
// - positive spike → income only, negative spike → expense only
// - filter by significance (>= 2% of spike delta)
const significantTransactions = computed(() => {
  const threshold = Math.abs(props.deltaAbsolute) * 0.02;
  const relevantType = props.isPositive ? TRANSACTION_TYPES.income : TRANSACTION_TYPES.expense;

  return props.transactions
    .filter((tx) => {
      if (isTwoLegTransfer(tx.transferNature)) return false;
      if (Math.abs(tx.refAmount) < threshold) return false;
      // Out-of-wallet transfers don't have a matching type, keep them based on amount sign
      if (tx.transferNature === TRANSACTION_TRANSFER_NATURE.transfer_out_wallet) return true;
      return tx.transactionType === relevantType;
    })
    .slice(0, 3);
});

defineEmits<{
  close: [];
  'see-all': [];
}>();

const restoreMarkerFocus = (event: Event) => {
  if (!props.anchor?.isConnected) return;
  event.preventDefault();
  props.anchor.focus({ preventScroll: true });
};
</script>
