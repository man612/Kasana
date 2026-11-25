<template>
  <div
    class="bg-background flex h-dvh max-md:flex-col"
    @touchstart.passive="onDashboardTouchStart"
    @touchend="onDashboardTouchEnd"
    @touchcancel="clearDashboardTouch"
    @scroll.capture="onDetailScroll"
    @focusin="revealNavigationOnKeyboard"
  >
    <div
      v-if="!isMobileView && !isSettingsRoute && !isFocusPage"
      class="relative h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      :class="isCollapsed ? 'w-16' : 'w-75'"
    >
      <Transition name="lajur-sidebar" mode="out-in">
        <SidebarRail v-if="isCollapsed" key="rail" />
        <Sidebar v-else key="full" />
      </Transition>
    </div>

    <div class="[container-type:size] min-h-0 min-w-0 flex-1">
      <ScrollArea ref="scrollAreaRef" class="h-full" scrollbar-class="z-40" :scroll-area-id="SCROLL_AREA_IDS.dashboard">
        <ui-header v-show="!isFocusPage" class="bg-card dark:bg-background sticky top-0 z-30" />

        <template v-if="isAppInitialized">
          <div :class="!isFocusPage && !isDetailPage && route.name !== ROUTES_NAMES.transactions && 'max-md:pb-4'">
            <RoutePageOutlet />
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
    </div>

    <div
      v-if="isMobileView && !isFocusPage"
      class="grid shrink-0 overflow-hidden motion-safe:transition-[grid-template-rows] motion-safe:duration-180"
      :class="hideBottomNavigation ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
      :inert="hideBottomNavigation"
      :aria-hidden="hideBottomNavigation ? true : undefined"
    >
      <div class="min-h-0">
        <BottomNavbar />
      </div>
    </div>

    <!-- Quick Start Onboarding Sidebar (desktop only) -->
    <template v-if="!isMobileView && !isFocusPage">
      <QuickStartSidebar />
    </template>

    <!-- Quick Start Onboarding (mobile: floating trigger + drawer) -->
    <template v-if="isMobileView && !isFocusPage">
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
import RoutePageOutlet from '@/components/common/route-page-outlet.vue';
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
import { computed, nextTick, ref, watch } from 'vue';
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
const isFocusPage = computed(() => route.meta.focusPage === true);
const detailRoutes = new Set<string>([
  ROUTES_NAMES.account,
  ROUTES_NAMES.accountsVehicleDetails,
  ROUTES_NAMES.loanDetail,
  ROUTES_NAMES.portfolioDetail,
]);
const isDetailPage = computed(() => detailRoutes.has(String(route.name)));
const scrollHidesNavigation = computed(
  () => (isDetailPage.value && route.name !== ROUTES_NAMES.portfolioDetail) || route.name === ROUTES_NAMES.investments,
);
const isNavigationScrolledAway = ref(false);
const hideBottomNavigation = computed(
  () => route.name === ROUTES_NAMES.portfolioDetail || isNavigationScrolledAway.value,
);
const SCROLL_DIRECTION_THRESHOLD = 24;
let scrollTarget: HTMLElement | undefined;
let previousScrollTop = 0;
let directionDistance = 0;
let ignoreScrollUntil = 0;
const resetNavigationScroll = () => {
  isNavigationScrolledAway.value = false;
  scrollTarget = undefined;
  directionDistance = 0;
  ignoreScrollUntil = 0;
};
watch(() => route.path, resetNavigationScroll, { flush: 'sync' });
const onDetailScroll = (event: Event) => {
  if (!isMobileView.value || !scrollHidesNavigation.value) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const viewport = scrollAreaRef.value?.viewportRef?.viewportElement;
  const isTabViewport = target.classList.contains('lajur-detail-scroll-viewport');
  if (!isTabViewport && target !== viewport) return;
  const top = target.scrollTop;
  if (scrollTarget !== target) {
    scrollTarget = target;
    previousScrollTop = 0;
    directionDistance = 0;
  }
  const delta = top - previousScrollTop;
  previousScrollTop = top;
  if (top <= 1) {
    isNavigationScrolledAway.value = false;
    directionDistance = 0;
    return;
  }
  if (performance.now() < ignoreScrollUntil || target.scrollHeight <= target.clientHeight + 1) return;
  if (Math.sign(delta) !== Math.sign(directionDistance)) directionDistance = 0;
  directionDistance += delta;
  if (Math.abs(directionDistance) < SCROLL_DIRECTION_THRESHOLD) return;
  isNavigationScrolledAway.value = directionDistance > 0;
  directionDistance = 0;
  ignoreScrollUntil = performance.now() + 210;
};
const revealNavigationOnKeyboard = (event: FocusEvent) => {
  if (event.target instanceof Element && event.target.matches(':focus-visible')) resetNavigationScroll();
};

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
  if (
    isFocusPage.value ||
    !isMobileView.value ||
    !mobilePageSwipeEnabled.value ||
    isMobileSheetOpen.value ||
    event.touches.length !== 1
  )
    return;
  const touch = event.touches[0]!;
  // Avoid the OS back-gesture edge and don't intercept buttons, fields, charts,
  // interactive widgets, or horizontal carousels.
  if (touch.clientX <= 62 || touch.clientX > window.innerWidth - 24) return;
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      'button, input, select, textarea, a, nav, [role="slider"], [role="dialog"], svg, canvas, [data-no-nav-swipe], [data-tab-swipe]',
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

const scrollPositions = new Map<string, number>();
watch(
  () => route.path,
  async (current, previous) => {
    const viewport = scrollAreaRef.value?.viewportRef?.viewportElement;
    if (!viewport) return;
    scrollPositions.delete(previous);
    scrollPositions.set(previous, viewport.scrollTop);
    if (scrollPositions.size > 30) scrollPositions.delete(scrollPositions.keys().next().value!);
    await nextTick();
    if (route.path === current) viewport.scrollTop = scrollPositions.get(current) ?? 0;
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
