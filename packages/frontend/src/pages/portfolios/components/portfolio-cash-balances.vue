<template>
  <Card
    data-tab-swipe
    class="touch-pan-y gap-2"
    @touchstart.passive="begin"
    @touchend.passive="end"
    @touchcancel.passive="cancel"
  >
    <CardHeader class="pb-1">
      <div class="flex flex-wrap items-center gap-3">
        <div class="bg-primary/10 flex size-9 items-center justify-center rounded-lg">
          <WalletIcon class="text-primary-text size-5" />
        </div>
        <CardTitle class="text-lg">{{ $t('portfolioDetail.cashBalances.title') }}</CardTitle>

        <!-- Desktop: inline buttons -->
        <template v-if="!isMobile">
          <DirectCashTransactionDialog :portfolio-id="portfolioId" :portfolio="portfolio">
            <UiButton variant="outline" size="sm">
              <PlusIcon class="mr-2 size-4" />
              {{ $t('portfolioDetail.cashBalances.cashTransactions.addButton') }}
            </UiButton>
          </DirectCashTransactionDialog>

          <PortfolioTransferDialog :portfolio="portfolio" context="portfolio">
            <UiButton variant="outline" size="sm">
              <ArrowRightLeftIcon class="mr-2 size-4" />
              {{ $t('portfolioDetail.actions.transfer') }}
            </UiButton>
          </PortfolioTransferDialog>
        </template>

        <!-- Mobile: dropdown menu -->
        <template v-else>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <UiButton variant="outline" size="icon-sm" :aria-label="$t('investments.menu.actions')">
                <EllipsisVerticalIcon class="size-4" />
              </UiButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" @close-auto-focus="openSelectedCashAction">
              <DropdownMenuItem @select="selectedAction = 'cash'">
                <PlusIcon class="mr-2 size-4" />
                {{ $t('portfolioDetail.cashBalances.cashTransactions.addButton') }}
              </DropdownMenuItem>
              <DropdownMenuItem @select="selectedAction = 'transfer'">
                <ArrowRightLeftIcon class="mr-2 size-4" />
                {{ $t('portfolioDetail.actions.transfer') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Dialogs opened via dropdown (no trigger slots needed) -->
          <DirectCashTransactionDialog v-model:open="isCashTxOpen" :portfolio-id="portfolioId" :portfolio="portfolio" />
          <PortfolioTransferDialog v-model:open="isTransferOpen" :portfolio="portfolio" context="portfolio" />
        </template>
      </div>
    </CardHeader>
    <CardContent class="pt-0">
      <PillTabs v-model="activeTab" :items="tabItems" full-width />

      <div class="mt-4">
        <PortfolioCashOverview v-if="activeTab === 'balances'" :portfolio-id="portfolioId" />
        <PortfolioCashTransactionsList
          v-else-if="activeTab === 'cash-transactions'"
          :portfolio-id="portfolioId"
          :portfolio="portfolio"
        />
        <PortfolioBuysSellsList v-else-if="activeTab === 'buys-sells'" :portfolio-id="portfolioId" />
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import DirectCashTransactionDialog from '@/components/dialogs/direct-cash-transaction-dialog.vue';
import PortfolioTransferDialog from '@/components/dialogs/portfolio-transfer-dialog.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/common/dropdown-menu';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lib/ui/card';
import { PillTabs } from '@/components/lib/ui/pill-tabs';
import { useHorizontalTabSwipe } from '@/composable/use-horizontal-tab-swipe';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { ArrowRightLeftIcon, EllipsisVerticalIcon, PlusIcon, WalletIcon } from '@lucide/vue';
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PortfolioModel } from '@bt/shared/types';

import PortfolioBuysSellsList from './portfolio-buys-sells-list.vue';
import PortfolioCashOverview from './portfolio-cash-overview.vue';
import PortfolioCashTransactionsList from './portfolio-cash-transactions-list.vue';

const props = defineProps<{ portfolioId: string; portfolio: PortfolioModel }>();
const portfolioId = toRef(props, 'portfolioId');

const { t } = useI18n();

const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

// Mobile dropdown dialog state
const isCashTxOpen = ref(false);
const isTransferOpen = ref(false);
let selectedAction: 'cash' | 'transfer' | undefined;

const openSelectedCashAction = (event: Event) => {
  if (!selectedAction) return;
  event.preventDefault();
  isCashTxOpen.value = selectedAction === 'cash';
  isTransferOpen.value = selectedAction === 'transfer';
  selectedAction = undefined;
};

const activeTab = ref('balances');

const tabItems = computed(() => [
  { value: 'balances', label: t('portfolioDetail.cashBalances.tabs.balances') },
  { value: 'cash-transactions', label: t('portfolioDetail.cashBalances.tabs.cashTransactions') },
  { value: 'buys-sells', label: t('portfolioDetail.cashBalances.tabs.buysSells') },
]);
const { begin, end, cancel } = useHorizontalTabSwipe({
  current: activeTab,
  values: () => tabItems.value.map(({ value }) => value),
  select: (value) => {
    activeTab.value = value;
  },
});
</script>
