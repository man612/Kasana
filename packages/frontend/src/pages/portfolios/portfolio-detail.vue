<template>
  <PageWrapper class="lajur-detail-page flex flex-col gap-3">
    <ResourceNotFound
      v-if="isNotFound"
      :title="$t('portfolioDetail.notFoundTitle')"
      :description="$t('portfolioDetail.notFoundDescription')"
      :link-label="$t('portfolioDetail.backToInvestments')"
      :link-to="{ name: ROUTES_NAMES.investments }"
    />

    <template v-else>
      <header class="bg-card grid shrink-0 gap-2 rounded-xl border p-3">
        <!-- Title and Actions row -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-3">
            <EditableEntityLogo
              v-if="portfolio"
              :entity="portfolio"
              flow="portfolioLogo"
              :save="saveLogo"
              class="size-10"
            >
              <PortfolioLogo :portfolio="portfolio" class="size-full" />
            </EditableEntityLogo>
            <div v-else-if="isLoading" class="bg-muted size-10 animate-pulse rounded-lg" />
            <div>
              <h1 v-if="portfolio" class="text-lg font-semibold tracking-tight wrap-anywhere">{{ portfolio.name }}</h1>
              <h1 v-else-if="isLoading" class="text-2xl font-semibold tracking-tight">
                {{ $t('portfolioDetail.loading') }}
              </h1>
              <p v-if="portfolio" class="text-muted-foreground text-sm">{{ $t('portfolioDetail.subtitle') }}</p>
            </div>
          </div>

          <div v-if="portfolio" class="flex flex-wrap items-center gap-2">
            <EditPortfolioDialog :portfolio="portfolio" @updated="refetch">
              <UiButton variant="outline" size="sm">
                <PencilIcon class="size-4" />
                {{ $t('portfolioDetail.actions.edit') }}
              </UiButton>
            </EditPortfolioDialog>

            <DeletePortfolioDialog :portfolio-id="portfolio.id" @deleted="handleDeletion">
              <UiButton variant="destructive" size="sm">
                <Trash2Icon class="size-4" />
                {{ $t('portfolioDetail.actions.delete') }}
              </UiButton>
            </DeletePortfolioDialog>
          </div>
        </div>
        <PortfolioBalance v-if="portfolio" :portfolio-id="portfolioId" compact />
      </header>

      <!-- Main Content -->
      <DetailTabs v-model="activeTab" :values="['summary', 'holdings']" v-if="portfolio">
        <template #tabs>
          <TabsList class="max-w-full">
            <TabsTrigger value="summary">{{ $t('portfolioDetail.sections.summary') }}</TabsTrigger>
            <TabsTrigger value="holdings">{{ $t('portfolioDetail.sections.holdings') }}</TabsTrigger>
          </TabsList>
        </template>
        <TabsContent value="summary" class="grid min-w-0 gap-4">
          <PortfolioCashBalances :portfolio-id="portfolioId" :portfolio="portfolio" />
        </TabsContent>
        <TabsContent value="holdings" class="min-w-0">
          <HoldingsSummary :portfolio-id="portfolioId" />
        </TabsContent>
      </DetailTabs>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="py-12 text-center">
        <div
          class="border-primary/20 mb-4 inline-flex size-12 items-center justify-center rounded-full border-2 border-t-transparent"
        >
          <div class="bg-primary/20 size-6 animate-pulse rounded"></div>
        </div>
        <p class="text-muted-foreground">{{ $t('portfolioDetail.loadingDetails') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="py-12 text-center">
        <div class="bg-destructive/10 mb-4 inline-flex size-12 items-center justify-center rounded-full">
          <AlertCircleIcon class="text-destructive-text size-6" />
        </div>
        <p class="text-destructive-text mb-4">{{ $t('portfolioDetail.loadError') }}</p>
        <UiButton @click="refetch">{{ $t('portfolioDetail.tryAgain') }}</UiButton>
      </div>
    </template>
  </PageWrapper>
</template>

<script setup lang="ts">
import DetailTabs from '@/components/common/detail-tabs.vue';

import PageWrapper from '@/components/common/page-wrapper.vue';
import ResourceNotFound from '@/components/common/resource-not-found.vue';
import EditableEntityLogo from '@/components/common/editable-entity-logo.vue';
import PortfolioLogo from '@/components/common/portfolio-logo.vue';
import DeletePortfolioDialog from '@/components/dialogs/delete-portfolio-dialog.vue';
import EditPortfolioDialog from '@/components/dialogs/edit-portfolio-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { TabsContent, TabsList, TabsTrigger } from '@/components/lib/ui/tabs';
import { usePortfolio, useUpdatePortfolio } from '@/composable/data-queries/portfolios';
import { isResourceMissingError } from '@/js/errors';
import { ROUTES_NAMES } from '@/routes/constants';
import type { NonImageLogoPayload } from '@bt/shared/types';
import { AlertCircleIcon, PencilIcon, Trash2Icon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import HoldingsSummary from './components/holdings-summary.vue';
import PortfolioBalance from './components/portfolio-balance.vue';
import PortfolioCashBalances from './components/portfolio-cash-balances.vue';

const activeTab = ref('summary');
const route = useRoute();
const router = useRouter();
const portfolioId = computed(() => String(route.params.portfolioId));

const { data: portfolio, isLoading, isError, error, refetch } = usePortfolio(portfolioId, { retry: false });

const updatePortfolio = useUpdatePortfolio();
const saveLogo = ({ payload }: { payload: NonImageLogoPayload }) =>
  updatePortfolio.mutateAsync({ portfolioId: portfolioId.value, ...payload });

const isNotFound = computed(() => isError.value && isResourceMissingError(error.value));

const handleDeletion = () => {
  router.push({ name: ROUTES_NAMES.investments });
};
</script>
