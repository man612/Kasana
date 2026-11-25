<template>
  <PageWrapper
    :data-sidebar-swipe-zone="!isEditMode ? '' : undefined"
    :class="[
      hasNoAccounts ? 'flex flex-col' : 'lajur-dashboard flex min-h-full flex-col pt-0',
      !isEditMode && 'max-md:touch-pan-y',
    ]"
  >
    <!-- The period bar starts at its sticky offset and keeps that geometry throughout scrolling. -->
    <div
      v-if="!hasNoAccounts"
      class="sticky top-(--header-height) z-(--z-navbar) order-first -mx-4 [overflow-anchor:none] md:-mx-6"
    >
      <div
        class="bg-background/95 supports-backdrop-filter:bg-background/80 relative grid h-(--lajur-dashboard-period-height) grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center border-b px-2 backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)_minmax(0,1fr)] md:px-6"
        data-testid="dashboard-period-bar"
      >
        <div aria-hidden="true" />
        <PeriodSelector v-model="currentPeriod" :payday="payday" :inert="isEditMode && isMobileView" />
        <DashboardEditToolbar
          v-show="!isEditMode || !isMobileView"
          class="justify-self-end"
          compact-mobile
          :is-edit-mode="isEditMode && !isMobileView"
          @enter="gridRef?.enterEditMode()"
          @save="gridRef?.saveLayout()"
          @cancel="gridRef?.cancelEdit()"
        />
        <Transition name="lajur-info-reveal">
          <div v-if="isPeriodLoading" role="status" class="pointer-events-none absolute inset-x-0 bottom-0">
            <span class="bg-primary/70 block h-0.5 motion-safe:animate-pulse" />
            <span
              class="bg-card text-muted-foreground absolute top-full right-2 rounded-b-md border-x border-b px-2 py-0.5 text-xs"
            >
              {{ $t('dashboard.periodSelector.loadingPeriod') }}
            </span>
          </div>
        </Transition>
      </div>
    </div>

    <template v-if="hasNoAccounts">
      <DashboardOnboarding />
    </template>
    <template v-else>
      <DashboardGrid
        ref="gridRef"
        class="mt-3 max-md:mb-4"
        :class="isEditMode && 'max-md:pb-16'"
        :aria-busy="isPeriodLoading"
        :current-period="currentPeriod"
      />

      <RecoveryMethodBanner />

      <Teleport to="body">
        <Transition name="lajur-info-reveal">
          <DashboardEditToolbar
            v-if="isEditMode && isMobileView"
            class="bg-background/95 fixed inset-x-0 bottom-[var(--bottom-navbar-height,4rem)] z-(--z-navbar) justify-center border-t px-6 py-3 backdrop-blur-sm"
            data-testid="dashboard-mobile-edit-toolbar"
            :is-edit-mode="true"
            @save="gridRef?.saveLayout()"
            @cancel="gridRef?.cancelEdit()"
          />
        </Transition>
      </Teleport>
    </template>
  </PageWrapper>
</template>

<script lang="ts" setup>
import RecoveryMethodBanner from '@/components/banners/recovery-method-banner.vue';
import PageWrapper from '@/components/common/page-wrapper.vue';
import DashboardOnboarding from '@/components/widgets/dashboard-onboarding.vue';
import { useUserSettings } from '@/composable/data-queries/user-settings';
import { getPayPeriod } from '@/composable/use-period-navigation';
import { useAccountsStore } from '@/stores';
import { useIsFetching } from '@tanstack/vue-query';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { isSameDay, isValid, parseISO } from 'date-fns';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import DashboardEditToolbar from './components/dashboard-edit-toolbar.vue';
import DashboardGrid from './components/dashboard-grid.vue';
import PeriodSelector from './components/period-selector.vue';
import { type Period } from './types';

const route = useRoute();

const accountsStore = useAccountsStore();
const { accounts, isAccountsFetched, isAccountsError } = storeToRefs(accountsStore);
const hasNoAccounts = computed(
  () => isAccountsFetched.value && !isAccountsError.value && (accounts.value?.length ?? 0) === 0,
);

defineOptions({
  name: 'page-dashboard',
});

const gridRef = ref<InstanceType<typeof DashboardGrid> | null>(null);
const isEditMode = computed(() => gridRef.value?.isEditMode ?? false);
const isMobileView = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

const { data: userSettings } = useUserSettings();
const payday = computed(() => userSettings.value?.payday ?? 1);

// Get initial period from URL or default to the current pay period
const getInitialPeriod = (): Period => {
  const { from, to } = route.query;
  if (typeof from === 'string' && typeof to === 'string') {
    const start = parseISO(from);
    const end = parseISO(to);
    if (isValid(start) && isValid(end) && start <= end) return { from: start, to: end };
  }
  return getPayPeriod({ date: new Date(), payday: payday.value });
};

const currentPeriod = ref<Period>(getInitialPeriod());
const pendingWidgets = useIsFetching({
  predicate: (query) =>
    query.isActive() && query.queryKey.some((key) => typeof key === 'string' && key.startsWith('widget-')),
});
const isPeriodLoading = computed(() => pendingWidgets.value > 0);

// Settings can arrive after mount; move the period only if it is still the old default.
watch(payday, (newPayday, oldPayday) => {
  const oldDefault = getPayPeriod({ date: new Date(), payday: oldPayday });
  if (isSameDay(currentPeriod.value.from, oldDefault.from) && isSameDay(currentPeriod.value.to, oldDefault.to)) {
    currentPeriod.value = getPayPeriod({ date: new Date(), payday: newPayday });
  }
});
</script>
