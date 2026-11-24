<script setup lang="ts">
import MenuScrim from '@/components/common/menu-scrim.vue';
import OverlayLayer from '@/components/common/overlay-layer.vue';
import { cn } from '@/lib/utils';
import { reactiveOmit } from '@vueuse/core';
import {
  PopoverContent,
  type PopoverContentEmits,
  type PopoverContentProps,
  PopoverPortal,
  injectPopoverRootContext,
  useForwardPropsEmits,
} from 'reka-ui';
import { type HTMLAttributes, computed, nextTick, ref, watch } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    PopoverContentProps & {
      class?: HTMLAttributes['class'];
      /**
       * Keeps the side resolved on open once the user interacts with the content,
       * so height changes inside it don't flip the popover to the opposite side.
       */
      lockSide?: boolean;
      /** Show a dimmed backdrop behind the anchored panel. */
      dimBackdrop?: boolean;
    }
  >(),
  {
    sideOffset: 6,
    class: '',
    dimBackdrop: true,
  },
);
const emits = defineEmits<PopoverContentEmits>();

const forwarded = useForwardPropsEmits(reactiveOmit(props, 'lockSide', 'dimBackdrop'), emits);

const rootContext = injectPopoverRootContext();
const lockedSide = ref<PopoverContentProps['side']>();

watch(rootContext.open, (open) => {
  if (open) lockedSide.value = undefined;
});

// Locks on user input rather than on mount: the side is only resolved after floating-ui's async positioning.
const lockCurrentSide = (event: Event) => {
  if (!props.lockSide || lockedSide.value) return;
  lockedSide.value = (event.currentTarget as HTMLElement).dataset.side as PopoverContentProps['side'];
};

const focusPopover = async (event: Event) => {
  const surface = event.target;
  const previousFocus = document.activeElement;
  await nextTick();
  if (
    rootContext.open.value &&
    rootContext.modal.value &&
    surface instanceof HTMLElement &&
    document.activeElement === previousFocus &&
    !surface.contains(previousFocus)
  ) {
    surface.focus({ preventScroll: true });
  }
};

const lockedPosition = computed(() => (lockedSide.value ? { side: lockedSide.value, sideFlip: false } : {}));
</script>

<template>
  <PopoverPortal>
    <OverlayLayer :open="rootContext.open.value">
      <MenuScrim :open="rootContext.open.value && (rootContext.modal.value || dimBackdrop)" :dim="dimBackdrop" />
      <PopoverContent
        :aria-modal="rootContext.modal.value || undefined"
        :inert="!rootContext.open.value"
        v-bind="{ ...forwarded, ...$attrs, ...lockedPosition }"
        :collision-padding="12"
        :style="{ maxHeight: 'min(calc(100dvh - 1.5rem), var(--reka-popover-content-available-height, 100dvh))' }"
        :class="
          cn(
            'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-out-to-top-2 data-[side=top]:slide-out-to-bottom-2 data-[side=left]:slide-out-to-right-2 data-[side=right]:slide-out-to-left-2 pointer-events-auto z-(--z-over-dialog) w-72 origin-(--reka-popover-content-transform-origin) overflow-y-auto overscroll-contain rounded-md border p-4 shadow-md outline-hidden duration-200 motion-reduce:animate-none!',
            props.class,
          )
        "
        @open-auto-focus="focusPopover"
        @pointerdown.capture="lockCurrentSide"
        @keydown.capture="lockCurrentSide"
      >
        <slot />
      </PopoverContent>
    </OverlayLayer>
  </PopoverPortal>
</template>
