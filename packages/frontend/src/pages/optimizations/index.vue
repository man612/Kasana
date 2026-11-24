<script setup lang="ts">
import NavigationSectionTitle from '@/components/sidebar/navigation-section-title.vue';
import PageWrapper from '@/components/common/page-wrapper.vue';
import { Card } from '@/components/lib/ui/card';
import { useTransactionAutomations } from '@/composable/data-queries/transaction-automations';
import { ROUTES_NAMES } from '@/routes/constants';
import { AI_FEATURE } from '@bt/shared/types';
import { ArrowRightLeftIcon, ChevronRightIcon, GitMergeIcon, HistoryIcon, SparklesIcon } from '@lucide/vue';
import { defineAsyncComponent, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import OptimizationHelp from './components/optimization-help.vue';
import { useOptimizationAiBlocker } from './use-optimization-ai-blocker';

const ApplyToHistoryDialog = defineAsyncComponent(
  () => import('@/pages/automations/components/apply-to-history-dialog.vue'),
);
const route = useRoute();
const isApplyOpen = ref(route.query.applyRules === '1');
const isApplyMounted = ref(isApplyOpen.value);
const openApply = () => {
  isApplyMounted.value = true;
  isApplyOpen.value = true;
};
const { list: automations, isLoading, isError, refetch } = useTransactionAutomations({ enabled: isApplyOpen });

const aiBlocker = useOptimizationAiBlocker({ feature: AI_FEATURE.categorization });

const tools = [
  { key: 'transfers', icon: ArrowRightLeftIcon, route: ROUTES_NAMES.optimizationsTransfers },
  { key: 'aiCategorization', icon: SparklesIcon, route: ROUTES_NAMES.optimizationsAiCategorization },
  { key: 'reconciliation', icon: GitMergeIcon, route: ROUTES_NAMES.optimizationsReconciliation },
  { key: 'applyRules', icon: HistoryIcon },
] as const;
</script>

<template>
  <PageWrapper>
    <div class="grid max-w-2xl gap-4">
      <header>
        <NavigationSectionTitle
          section="transactions"
          :label="$t('optimizations.title')"
          class="text-2xl font-semibold tracking-tight"
        />
        <p class="text-muted-foreground mt-1 text-sm">{{ $t('optimizations.landingDescription') }}</p>
      </header>

      <Card class="divide-border divide-y overflow-hidden py-0">
        <component
          :is="'route' in tool ? RouterLink : 'button'"
          v-for="tool in tools"
          :key="tool.key"
          v-bind="'route' in tool ? { to: { name: tool.route } } : { type: 'button' }"
          class="hover:bg-muted/60 focus-visible:ring-ring flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-4"
          @click="'route' in tool || openApply()"
        >
          <span class="bg-primary/10 text-primary-text grid size-10 shrink-0 place-items-center rounded-lg">
            <component :is="tool.icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm leading-tight font-semibold">{{
              $t(`optimizations.cards.${tool.key}.title`)
            }}</span>
            <span
              v-if="tool.key === 'aiCategorization' && aiBlocker && aiBlocker !== 'loading'"
              class="bg-muted text-muted-foreground mt-1 inline-block rounded-md px-1.5 py-0.5 text-xs"
            >
              {{ $t(`optimizations.aiAvailability.${aiBlocker}.label`) }}
            </span>
            <span class="text-muted-foreground mt-1 block text-sm leading-snug">
              {{ $t(`optimizations.cards.${tool.key}.description`) }}
            </span>
          </span>
          <ChevronRightIcon class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        </component>
      </Card>
    </div>

    <ApplyToHistoryDialog
      v-if="isApplyMounted"
      v-model:open="isApplyOpen"
      :rule="null"
      :rules="automations"
      :rules-loading="isLoading"
      :rules-error="isError"
      :prefer-localized-error="$i18n.locale.startsWith('id')"
      @retry-rules="refetch()"
      @closed="isApplyMounted = false"
    >
      <template #pick-help>
        <OptimizationHelp feature="applyRules" />
      </template>
    </ApplyToHistoryDialog>
  </PageWrapper>
</template>
