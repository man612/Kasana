<template>
  <PageWrapper>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t('investments.title') }}</h1>

      <DemoRestricted feature="create_portfolio_header" :message="$t('demo.featureNotAvailable')">
        <CreatePortfolioDialog v-if="!isDemo && portfolios.length > 0">
          <UiButton>
            <PlusIcon class="size-4" />
            {{ $t('investments.createButton') }}
          </UiButton>
        </CreatePortfolioDialog>
        <UiButton v-else-if="portfolios.length > 0" disabled>
          <PlusIcon class="size-4" />
          {{ $t('investments.createButton') }}
        </UiButton>
      </DemoRestricted>
    </div>

    <template v-if="portfoliosQuery.isLoading.value">
      <div class="mb-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
        <Card v-for="i in 3" :key="i" class="overflow-hidden">
          <CardHeader class="p-4 pr-14 pb-2">
            <div class="flex items-start gap-3">
              <div class="bg-muted size-10 shrink-0 animate-pulse rounded-lg" />
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="bg-muted h-5 w-32 animate-pulse rounded" />
                <div class="bg-muted h-3 w-20 animate-pulse rounded" />
              </div>
            </div>
          </CardHeader>
          <CardContent class="p-4 pt-2">
            <div class="space-y-1.5">
              <div class="bg-muted h-7 w-28 animate-pulse rounded" />
              <div class="bg-muted h-5 w-24 animate-pulse rounded" />
              <div class="bg-muted h-4 w-20 animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <template v-else-if="portfoliosQuery.error.value && !portfolios.length">
      <div class="py-12 text-center">
        <div class="text-destructive-text mb-4">{{ $t('investments.loadError') }}</div>
        <UiButton @click="portfoliosQuery.refetch()">{{ $t('investments.tryAgain') }}</UiButton>
      </div>
    </template>

    <template v-else-if="portfolios.length">
      <Card v-if="activePortfolios.length" class="@container mb-4 p-4">
        <dl class="grid gap-3 @sm:grid-cols-2">
          <div v-for="field in summaryFields" :key="field" class="min-w-0">
            <dt class="text-muted-foreground text-xs">{{ $t(`investments.summary.${field}`) }}</dt>
            <dd
              class="mt-0.5 font-semibold break-words tabular-nums"
              :class="field === 'totalPortfolioValue' ? 'text-2xl' : 'text-base'"
            >
              {{
                totals?.[field] == null || (field === 'unrealizedGainValue' && unpricedHoldings)
                  ? '—'
                  : formatAmountByCurrencyCode(totals[field], INVESTMENTS_DISPLAY_CURRENCY)
              }}
            </dd>
          </div>
        </dl>
        <p v-if="summariesQuery.isFetching.value" class="text-muted-foreground mt-3 text-xs" role="status">
          {{ $t('investments.summary.refreshing') }}
        </p>
        <p v-else-if="!totals || summariesQuery.isError.value" class="text-muted-foreground mt-3 text-xs" role="status">
          {{ $t('investments.summary.incomplete') }}
        </p>
        <p v-else-if="unpricedHoldings" class="text-warning-text mt-3 text-xs">
          {{ $t('investments.summary.unpriced', { count: unpricedHoldings }) }}
        </p>
        <p v-else class="text-muted-foreground mt-3 text-xs">{{ $t('investments.summary.help') }}</p>
        <RouterLink
          :to="{ name: ROUTES_NAMES.analyticsInvestmentContributions }"
          class="text-primary-text mt-2 inline-flex min-h-9 items-center text-sm font-medium underline-offset-4 hover:underline"
        >
          {{ $t('investments.summary.contributions') }}
        </RouterLink>
      </Card>
      <div class="mb-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
        <template v-for="portfolio in portfolios" :key="portfolio.id">
          <Card
            :class="
              cn(
                'group relative overflow-hidden transition-all duration-200 hover:shadow-md',
                !portfolio.isEnabled && 'opacity-60',
              )
            "
          >
            <!-- Menu button -->
            <div class="absolute top-3 right-3 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <UiButton variant="ghost" size="icon" class="size-9" :aria-label="$t('investments.menu.actions')">
                    <MoreVerticalIcon class="size-4" />
                  </UiButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <RouterLink
                      :to="{
                        name: ROUTES_NAMES.portfolioDetail,
                        params: { portfolioId: portfolio.id },
                      }"
                      class="flex w-full items-center"
                    >
                      <EyeIcon class="mr-2 size-4" />
                      {{ $t('investments.menu.view') }}
                    </RouterLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DeletePortfolioDialog v-if="!isDemo" :portfolio-id="portfolio.id">
                    <DropdownMenuItem
                      class="text-destructive-text focus:bg-destructive-text/10 focus:text-destructive-text"
                      @select.prevent
                    >
                      <Trash2Icon class="mr-2 size-4" />
                      {{ $t('investments.menu.delete') }}
                    </DropdownMenuItem>
                  </DeletePortfolioDialog>
                  <DemoRestricted v-else feature="delete_portfolio" :message="$t('demo.featureNotAvailable')">
                    <DropdownMenuItem
                      disabled
                      class="text-destructive-text focus:bg-destructive-text/10 focus:text-destructive-text"
                      @select.prevent
                    >
                      <Trash2Icon class="mr-2 size-4" />
                      {{ $t('investments.menu.delete') }}
                    </DropdownMenuItem>
                  </DemoRestricted>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <router-link
              :to="{
                name: ROUTES_NAMES.portfolioDetail,
                params: { portfolioId: portfolio.id },
              }"
              class="block h-full"
            >
              <CardHeader class="p-4 pr-14 pb-2">
                <div class="flex items-start gap-3">
                  <PortfolioLogo :portfolio="portfolio" class="size-10" />
                  <div class="min-w-0 flex-1">
                    <h3 class="truncate text-base leading-tight font-semibold tracking-tight">
                      {{ portfolio.name }}
                    </h3>
                    <p class="text-muted-foreground mt-0.5 text-xs">
                      {{ $t(`dialogs.createPortfolio.form.portfolioTypes.${portfolio.portfolioType}`) }}
                      <span v-if="!portfolio.isEnabled"> · {{ $t('investments.card.hidden') }}</span>
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent class="p-4 pt-2">
                <PortfolioCardBalance
                  :summary="summariesById.get(portfolio.id)"
                  :is-fetching="summariesQuery.isFetching.value"
                />

                <!-- Description -->
                <p v-if="portfolio.description" class="text-muted-foreground mt-3 line-clamp-2 text-xs leading-relaxed">
                  {{ portfolio.description }}
                </p>
              </CardContent>
            </router-link>
          </Card>
        </template>
      </div>
    </template>

    <template v-else>
      <div class="rounded-xl border p-6 text-center">
        <div class="mb-6">
          <div class="bg-muted mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <BriefcaseIcon class="text-muted-foreground size-8" />
          </div>
          <h3 class="text-foreground mb-2 text-xl font-semibold">{{ $t('investments.empty.title') }}</h3>
          <p class="text-muted-foreground mx-auto max-w-md text-base">
            {{ $t('investments.empty.description') }}
          </p>
        </div>
        <DemoRestricted feature="create_portfolio_empty_state" :message="$t('demo.featureNotAvailable')">
          <CreatePortfolioDialog v-if="!isDemo">
            <UiButton size="lg">
              <PlusIcon class="size-4" />
              {{ $t('investments.empty.createFirstButton') }}
            </UiButton>
          </CreatePortfolioDialog>
          <UiButton v-else size="lg" disabled>
            <PlusIcon class="size-4" />
            {{ $t('investments.empty.createFirstButton') }}
          </UiButton>
        </DemoRestricted>
      </div>
    </template>

    <PortfoliosTrash v-if="!isDemo" />
  </PageWrapper>
</template>

<script lang="ts" setup>
import { INVESTMENTS_DISPLAY_CURRENCY } from '@/common/utils/investment-units';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/common/dropdown-menu';
import PageWrapper from '@/components/common/page-wrapper.vue';
import PortfolioLogo from '@/components/common/portfolio-logo.vue';
import { DemoRestricted } from '@/components/demo';
import CreatePortfolioDialog from '@/components/dialogs/create-portfolio-dialog.vue';
import DeletePortfolioDialog from '@/components/dialogs/delete-portfolio-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
import { useExchangeRates } from '@/composable/data-queries/currencies';
import { usePortfolioSummaries } from '@/composable/data-queries/portfolio-summary';
import { useFormatCurrency } from '@/composable/formatters';
import { usePortfolios } from '@/composable/data-queries/portfolios';
import { cn } from '@/lib/utils';
import PortfolioCardBalance from '@/pages/investments/components/portfolio-card-balance.vue';
import PortfoliosTrash from '@/pages/investments/components/portfolios-trash.vue';
import { ROUTES_NAMES } from '@/routes/constants';
import { useUserStore } from '@/stores';
import { BriefcaseIcon, EyeIcon, MoreVerticalIcon, PlusIcon, Trash2Icon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

const userStore = useUserStore();
const { isDemo } = storeToRefs(userStore);
const { formatAmountByCurrencyCode } = useFormatCurrency();
const portfoliosQuery = usePortfolios();

// Copy before sorting: sort() mutates in place, and the source array is the query cache.
const portfolios = computed(() => [...(portfoliosQuery.data.value ?? [])].sort((a, b) => +b.isEnabled - +a.isEnabled));

const activePortfolios = computed(() => portfolios.value.filter((portfolio) => portfolio.isEnabled));
const summariesQuery = usePortfolioSummaries({ enabled: computed(() => portfolios.value.length > 0) });
const summariesById = computed(
  () => new Map(summariesQuery.data.value?.map((summary) => [summary.portfolioId, summary])),
);
const { convert } = useExchangeRates({
  enabled: computed(() =>
    activePortfolios.value.some((portfolio) => {
      const summary = summariesById.value.get(portfolio.id);
      return summary && summary.currencyCode !== INVESTMENTS_DISPLAY_CURRENCY;
    }),
  ),
});

const unpricedHoldings = computed(() =>
  activePortfolios.value.reduce(
    (total, { id }) => total + (summariesById.value.get(id)?.unpricedHoldingsCount ?? 0),
    0,
  ),
);

const summaryFields = ['totalPortfolioValue', 'totalCostBasis', 'unrealizedGainValue', 'realizedGainValue'] as const;
const totals = computed(() => {
  const summaries = activePortfolios.value.map(({ id }) => summariesById.value.get(id));
  if (!summaries.length || summaries.some((summary) => !summary)) return null;

  const result = { totalPortfolioValue: 0, totalCostBasis: 0, unrealizedGainValue: 0, realizedGainValue: 0 };
  for (const summary of summaries) {
    if (!summary) return null;
    for (const field of summaryFields) {
      const raw = Number(summary[field]);
      if (!Number.isFinite(raw)) return null;
      const amount =
        raw === 0
          ? 0
          : convert({
              amount: raw,
              from: summary.currencyCode,
              to: INVESTMENTS_DISPLAY_CURRENCY,
            });
      if (amount === null) return null;
      result[field] += amount;
    }
  }
  return result;
});
</script>
