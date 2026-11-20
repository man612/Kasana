<template>
  <div
    class="bg-background flex h-dvh max-md:flex-col"
    @touchstart.passive="onDashboardTouchStart"
    @touchend="onDashboardTouchEnd"
    @touchcancel="clearDashboardTouch"
  >
    <div
      v-if="!isMobileView && !isSettingsRoute"
      class="relative h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      :class="isCollapsed ? 'w-16' : 'w-75'"
    >
      <Transition name="lajur-sidebar" mode="out-in">
        <SidebarRail v-if="isCollapsed" key="rail" />
        <Sidebar v-else key="full" />
      </Transition>
    </div>

    <ScrollArea ref="scrollAreaRef" class="flex-1" scrollbar-class="z-40" :scroll-area-id="SCROLL_AREA_IDS.dashboard">
      <ui-header class="bg-card dark:bg-background sticky top-0 z-30" />

      <template v-if="isAppInitialized">
        <div class="max-md:pb-4">
          <router-view v-slot="{ Component, route }">
            <Transition name="kasana-page" mode="out-in">
              <component :is="Component" :key="route.matched[1]?.path ?? route.path" />
            </Transition>
          </router-view>
        </div>
      </template>
      <div v-else-if="initializationFailed" class="grid justify-items-start gap-3 p-6">
        <p role="status">{{ $t('common.errors.initializationFailed') }}</p>
        <Button type="button" variant="outline" @click="rootStore.fetchInitialData">{{
          $t('common.actions.retry')
        }}</Button>
      </div>
      <div v-else class="mx-auto grid w-full max-w-5xl gap-3 p-4" aria-busy="true" data-testid="dashboard-startup">
        <div class="bg-muted h-10 rounded-lg motion-safe:animate-pulse" aria-hidden="true" />
        <div
          v-for="index in 3"
          :key="index"
          class="bg-muted/75 h-32 rounded-xl border motion-safe:animate-pulse"
          aria-hidden="true"
        />
      </div>
    </ScrollArea>

    <template v-if="isMobileView">
      <BottomNavbar />
    </template>

    <!-- Quick Start Onboarding Sidebar (desktop only) -->
    <template v-if="!isMobileView">
      <QuickStartSidebar />
    </template>

    <!-- Quick Start Onboarding (mobile: floating trigger + drawer) -->
    <template v-if="isMobileView">
      <QuickStartTrigger />
      <QuickStartPanel />
    </template>

    <!-- Share invitation dialog: opens whenever ?invitation_token=… is in the URL.
         Email links + in-app notifications deep-link via this query param. -->
    <ShareInvitationDialog :token="invitationToken" @close="clearInvitationToken" />
  </div>
</template>

<script lang="ts" setup>
import { useHead } from '@unhead/vue';
import BottomNavbar from '@/components/bottom-navbar.vue';
import ShareInvitationDialog from '@/components/dialogs/share-invitation-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { SCROLL_AREA_IDS } from '@/components/lib/ui/scroll-area/types';
import { QuickStartPanel, QuickStartSidebar, QuickStartTrigger } from '@/components/quick-start';
import Sidebar from '@/components/sidebar/index.vue';
import SidebarRail from '@/components/sidebar/sidebar-rail.vue';
import { useSidebarCollapsed } from '@/components/sidebar/use-sidebar-collapsed';
import { isMobileSheetOpen } from '@/composable/global-state/mobile-sheet';
import { mobilePageSwipeEnabled } from '@/common/utils/mobile-navigation-gesture';
import UiHeader from '@/components/ui-header.vue';
import { useIdleEnabled } from '@/composable/use-idle-enabled';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { ROUTES_NAMES } from '@/routes/constants';
import { useCurrenciesStore, useOnboardingStore, useRootStore } from '@/stores';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const router = useRouter();
const route = useRoute();
const rootStore = useRootStore();
const userCurrenciesStore = useCurrenciesStore();
const onboardingStore = useOnboardingStore();
const idleEnabled = useIdleEnabled();
const { isCollapsed } = useSidebarCollapsed();
// The settings page owns a fully functional navigator; hide the main sidebar there.
const isSettingsRoute = computed(() => String(route.name ?? '').startsWith(ROUTES_NAMES.settings));
const isMobileView = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile, {
  wait: 50,
});

const primarySwipeRoutes = [
  ROUTES_NAMES.home,
  ROUTES_NAMES.accounts,
  ROUTES_NAMES.transactions,
  ROUTES_NAMES.analytics,
];
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null);
let dashboardTouch: { x: number; y: number } | null = null;
const clearDashboardTouch = () => {
  dashboardTouch = null;
};
const onDashboardTouchStart = (event: TouchEvent) => {
  if (!isMobileView.value || !mobilePageSwipeEnabled.value || isMobileSheetOpen.value || event.touches.length !== 1)
    return;
  const touch = event.touches[0]!;
  // Avoid the OS back-gesture edge and don't intercept buttons, fields, charts,
  // interactive widgets, or horizontal carousels.
  if (touch.clientX <= 62 || touch.clientX > window.innerWidth - 24) return;
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      'button, input, select, textarea, a, nav, [role="slider"], [role="dialog"], svg, canvas, [data-no-nav-swipe]',
    )
  )
    return;
  if (document.querySelector('[role="dialog"][data-state="open"], [aria-modal="true"]')) return;
  dashboardTouch = { x: touch.clientX, y: touch.clientY };
};
const onDashboardTouchEnd = (event: TouchEvent) => {
  if (!dashboardTouch || event.changedTouches.length !== 1) return;
  const start = dashboardTouch;
  dashboardTouch = null;
  if (isMobileSheetOpen.value) return;
  const touch = event.changedTouches[0]!;
  const dx = touch.clientX - start.x;
  const dy = touch.clientY - start.y;
  if (Math.abs(dx) <= 100 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
  const current = primarySwipeRoutes.indexOf(String(route.name) as typeof ROUTES_NAMES.home);
  if (current < 0) return;
  const next = current + (dx < 0 ? 1 : -1);
  if (next >= 0 && next < primarySwipeRoutes.length) void router.push({ name: primarySwipeRoutes[next]! });
};

watch(
  () => route.path,
  () => {
    if (scrollAreaRef.value?.viewportRef?.viewportElement) {
      scrollAreaRef.value.viewportRef.viewportElement.scrollTop = 0;
    }
  },
);

const { isAppInitialized, initializationFailed } = storeToRefs(rootStore);
const { isBaseCurrencyExists } = storeToRefs(userCurrenciesStore);

// The base-currency guard must run the instant the app is ready — it decides
// whether the user is even allowed on the dashboard — so it stays off the idle path.
watch(
  isAppInitialized,
  (value) => {
    if (value && !isBaseCurrencyExists.value) {
      router.push({ name: ROUTES_NAMES.welcome });
    }
  },
  { immediate: true },
);

// The onboarding "Quick Start" checklist is non-critical decoration, and the store
// already tracks task completion optimistically in memory — the fetched state only
// restores progress on a cold load. Defer it until the browser is idle so it stays
// off the dashboard's critical request path.
watch(
  [isAppInitialized, idleEnabled],
  ([initialized, idle]) => {
    if (initialized && idle) {
      onboardingStore.fetchOnboardingState();
    }
  },
  { immediate: true },
);

// Share invitation deep-link binding. The dialog opens whenever the URL carries
// `?invitation_token=…`. Closing the dialog clears the param so a refresh doesn't
// reopen it. (Replaces the previous standalone /shared-with-me/invitations/:token page.)
const invitationToken = computed(() => {
  const raw = route.query.invitation_token;
  return typeof raw === 'string' ? raw : '';
});

const clearInvitationToken = () => {
  if (!invitationToken.value) return;
  const { invitation_token: _omit, ...rest } = route.query;
  void _omit;
  router.replace({ ...route, query: rest });
};

// Watch route changes to auto-complete page-visit tasks
watch(
  () => route.name,
  (routeName) => {
    if (!onboardingStore.isInitialized) return;

    if (routeName === ROUTES_NAMES.analyticsCashFlow) {
      onboardingStore.completeTask('view-cash-flow');
    }
    if (routeName === ROUTES_NAMES.analytics || routeName === ROUTES_NAMES.analyticsTrendsComparison) {
      onboardingStore.completeTask('view-annual-overview');
    }
    if (routeName === ROUTES_NAMES.settingsAiFeatures) {
      onboardingStore.completeTask('review-ai-features');
    }
  },
);
</script>
