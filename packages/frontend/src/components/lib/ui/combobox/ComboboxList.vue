<script setup lang="ts">
import MenuScrim from '@/components/common/menu-scrim.vue';
import OverlayLayer from '@/components/common/overlay-layer.vue';
import { cn } from '@/lib/utils';
import { reactiveOmit } from '@vueuse/core';
import type { ComboboxContentEmits, ComboboxContentProps } from 'reka-ui';
import {
  ComboboxContent,
  ComboboxPortal,
  ComboboxViewport,
  FocusScope,
  injectComboboxRootContext,
  useForwardPropsEmits,
} from 'reka-ui';
import type { HTMLAttributes } from 'vue';

const props = withDefaults(defineProps<ComboboxContentProps & { class?: HTMLAttributes['class'] }>(), {
  position: 'popper',
  align: 'center',
  sideOffset: 4,
});
const emits = defineEmits<ComboboxContentEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const { open } = injectComboboxRootContext();
</script>

<template>
  <ComboboxPortal>
    <OverlayLayer :open="open">
      <MenuScrim :open="open" />
      <ComboboxContent
        v-bind="forwarded"
        :inert="!open"
        disable-outside-pointer-events
        body-lock
        :collision-padding="12"
        :style="{ maxHeight: 'min(calc(100dvh - 1.5rem), var(--reka-combobox-content-available-height, 100dvh))' }"
        :class="
          cn(
            'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-[200px] overflow-hidden rounded-md border shadow-md duration-200 outline-none motion-reduce:animate-none!',
            props.class,
          )
        "
      >
        <FocusScope as-child trapped>
          <ComboboxViewport>
            <slot />
          </ComboboxViewport>
        </FocusScope>
      </ComboboxContent>
    </OverlayLayer>
  </ComboboxPortal>
</template>
