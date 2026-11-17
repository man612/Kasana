<template>
  <div
    ref="navbarRef"
    class="bg-background/95 border-border/70 sticky right-0 bottom-0 left-0 z-(--z-navbar) border-t px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:px-4"
  >
    <nav class="mx-auto grid max-w-150 grid-cols-4 gap-1" :aria-label="'Navigasi utama'">
      <NavigationLinks bottom-nav />
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useCssVarFromElementSize } from '@/composable/use-css-var-from-element-size';

import NavigationLinks from './sidebar/navigation-links.vue';

const { elementRef: navbarRef } = useCssVarFromElementSize({
  cssVars: [{ cssVarName: '--bottom-navbar-height', sizeSource: 'borderBoxSize' }],
});
</script>
