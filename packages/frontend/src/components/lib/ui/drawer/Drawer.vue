<script lang="ts" setup>
import { useForwardPropsEmits } from 'reka-ui';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import type { DrawerRootEmits, DrawerRootProps } from 'vaul-vue';
import { DrawerRoot, DrawerRootNested } from 'vaul-vue';
import { computed, inject, provide } from 'vue';

import { IS_INSIDE_DRAWER } from './context';

const props = withDefaults(defineProps<DrawerRootProps>(), {
  shouldScaleBackground: true,
  handleOnly: false,
});

const emits = defineEmits<DrawerRootEmits>();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

const forwarded = useForwardPropsEmits(props, emits);

const isInsideDrawer = inject(IS_INSIDE_DRAWER, false);

// A drawer opened on top of another must use the nested root, or closing it unlocks page
// scroll: vaul's body-scroll lock is a module singleton that the nested root leaves alone.
// `nested` only forces it on — Vue casts an absent boolean prop to `false`, so an explicit
// `:nested="false"` cannot be told apart from no prop at all.
const isNested = computed(() => props.nested || isInsideDrawer);

provide(IS_INSIDE_DRAWER, true);
</script>

<template>
  <component
    :is="isNested ? DrawerRootNested : DrawerRoot"
    v-bind="forwarded"
    :handle-only="isMobile ? true : props.handleOnly"
    :should-scale-background="isMobile ? false : props.shouldScaleBackground"
  >
    <slot />
  </component>
</template>
