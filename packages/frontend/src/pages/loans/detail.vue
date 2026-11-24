<template>
  <PageWrapper>
    <template v-if="loanQuery.isLoading.value">
      <div class="@container/loans-detail grid grid-cols-1 gap-4 @3xl/loans-detail:grid-cols-2">
        <Card v-for="i in 4" :key="i">
          <CardHeader>
            <div class="bg-muted h-5 w-32 animate-pulse rounded" />
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="bg-muted h-8 w-40 animate-pulse rounded" />
            <div class="bg-muted h-3 w-full animate-pulse rounded" />
            <div class="bg-muted h-3 w-2/3 animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    </template>

    <template v-else-if="loanQuery.error.value || !loan">
      <div class="py-12 text-center">
        <div class="text-destructive-text mb-4">{{ $t('loans.detail.loadError') }}</div>
        <UiButton @click="loanQuery.refetch()">{{ $t('loans.tryAgain') }}</UiButton>
      </div>
    </template>

    <template v-else>
      <div class="@container/loans-detail grid gap-3">
        <ArchivedBanner v-if="isArchived" :loan="loan" />
        <SummaryCard :loan="loan">
          <template #actions>
            <RecordPaymentButton v-if="!isPaidOff" :loan="loan" />
            <LoanActionsMenu :loan="loan" />
          </template>
        </SummaryCard>
        <Tabs default-value="summary">
          <TabsList>
            <TabsTrigger value="summary">{{ $t('loans.detail.tabs.summary') }}</TabsTrigger>
            <TabsTrigger value="activity">{{ $t('loans.detail.tabs.activity') }}</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" class="grid min-w-0 gap-4">
            <LoanCostCard v-if="isPaidOff" :loan="loan" />
            <ProjectionCard v-else :loan="loan" />

            <Card>
              <CardContent class="p-4">
                <UiButton
                  type="button"
                  variant="ghost"
                  class="min-h-11 w-full justify-between px-0 text-left whitespace-normal"
                  :aria-expanded="isChartOpen"
                  :aria-controls="chartId"
                  @click="showChart"
                >
                  {{ $t(isPaidOff ? 'loans.detail.paidOff.chart.title' : 'loans.detail.payoffChart.title') }}
                  <ChevronDownIcon
                    class="size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200"
                    :class="isChartOpen && 'rotate-180'"
                    aria-hidden="true"
                  />
                </UiButton>
                <LayoutCollapse :id="chartId" :open="isChartOpen">
                  <div v-if="hasOpenedChart" class="pt-3">
                    <BalanceJourneyChart v-if="isPaidOff" :loan="loan" />
                    <PayoffProjectionChart v-else :loan="loan" />
                  </div>
                </LayoutCollapse>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" class="grid items-start gap-4 @3xl/loans-detail:grid-cols-2">
            <RecentPayments :loan="loan" />
            <EventsTimeline :events="loan.loanDetails.events" :currency-code="loan.currencyCode" />
          </TabsContent>
        </Tabs>
      </div>
    </template>
  </PageWrapper>
</template>

<script setup lang="ts">
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import PageWrapper from '@/components/common/page-wrapper.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/lib/ui/tabs';
import { useLoanById } from '@/composable/data-queries/loans';
import { ACCOUNT_STATUSES } from '@bt/shared/types';
import { ChevronDownIcon } from '@lucide/vue';
import { computed, defineAsyncComponent, ref, useId } from 'vue';

import ArchivedBanner from './components/archived-banner.vue';
import EventsTimeline from './components/events-timeline.vue';
import LoanActionsMenu from './components/loan-actions-menu.vue';
import LoanCostCard from './components/loan-cost-card.vue';
import ProjectionCard from './components/projection-card.vue';
import RecentPayments from './components/recent-payments.vue';
import RecordPaymentButton from './components/record-payment-button.vue';
import SummaryCard from './components/summary-card.vue';

const BalanceJourneyChart = defineAsyncComponent(() => import('./components/balance-journey-chart.vue'));
const PayoffProjectionChart = defineAsyncComponent(() => import('./components/payoff-projection-chart.vue'));

const props = defineProps<{ id: string }>();
const loanId = computed(() => props.id);
const loanQuery = useLoanById({ id: loanId });

const loan = computed(() => loanQuery.data.value ?? null);

const isPaidOff = computed(() => loan.value?.projection.isPaidOff ?? false);

const isArchived = computed(() => loan.value?.status === ACCOUNT_STATUSES.archived);

const chartId = useId();
const isChartOpen = ref(false);
const hasOpenedChart = ref(false);
const showChart = () => {
  hasOpenedChart.value = true;
  isChartOpen.value = !isChartOpen.value;
};
</script>
