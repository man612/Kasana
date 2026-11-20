<template>
  <div
    ref="navbarRef"
    class="bg-background/95 border-border/70 sticky right-0 bottom-0 left-0 z-(--z-navbar) border-t px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:px-4"
  >
    <nav
      class="mx-auto max-w-150 touch-pan-y"
      aria-label="Navigasi utama"
      @touchstart.passive="onNavTouchStart"
      @touchend="onNavTouchEnd"
      @touchcancel="clearNavTouch"
    >
      <NavigationLinks bottom-nav />
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useCssVarFromElementSize } from '@/composable/use-css-var-from-element-size';
import { ROUTES_NAMES } from '@/routes/constants';
import { useRoute, useRouter } from 'vue-router';

import NavigationLinks from './sidebar/navigation-links.vue';

const router = useRouter();
const route = useRoute();
const primaryNavRoutes = [ROUTES_NAMES.home, ROUTES_NAMES.accounts, ROUTES_NAMES.transactions, ROUTES_NAMES.analytics];
let navTouch: { x: number; y: number } | null = null;
const clearNavTouch = () => {
  navTouch = null;
};
const onNavTouchStart = (event: TouchEvent) => {
  if (event.touches.length !== 1) return;
  navTouch = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
};
const onNavTouchEnd = (event: TouchEvent) => {
  if (!navTouch || event.changedTouches.length !== 1) return;
  const start = navTouch;
  navTouch = null;
  const touch = event.changedTouches[0]!;
  const dx = touch.clientX - start.x;
  const dy = touch.clientY - start.y;
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
  const current = primaryNavRoutes.indexOf(String(route.name) as typeof ROUTES_NAMES.home);
  if (current < 0) return;
  const next = current + (dx < 0 ? 1 : -1);
  if (next < 0 || next >= primaryNavRoutes.length) return;
  void router.push({ name: primaryNavRoutes[next]! });
  event.preventDefault();
};
const { elementRef: navbarRef } = useCssVarFromElementSize({
  cssVars: [{ cssVarName: '--bottom-navbar-height', sizeSource: 'borderBoxSize' }],
});
</script>
