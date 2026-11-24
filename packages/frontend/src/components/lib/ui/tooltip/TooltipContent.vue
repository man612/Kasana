<script setup lang="ts">
import { cn } from '@/lib/utils';
import {
  TooltipContent,
  type TooltipContentEmits,
  type TooltipContentProps,
  TooltipPortal,
  injectTooltipRootContext,
  useForwardPropsEmits,
} from 'reka-ui';
import { type HTMLAttributes, computed } from 'vue';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>(), {
  sideOffset: 4,
  class: '',
});

const emits = defineEmits<TooltipContentEmits>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { class: _, ...delegated } = props;

  return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const { trigger } = injectTooltipRootContext();

// Keep a dialog tooltip in its own layer, including when another dialog opens above it.
const overlay = computed(() => trigger.value?.closest<HTMLElement>('[data-lajur-overlay-layer]'));
</script>

<template>
  <TooltipPortal :to="overlay ?? 'body'">
    <TooltipContent
      v-bind="{ ...forwarded, ...$attrs }"
      :collision-padding="12"
      :class="
        cn(
          'bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-h-[min(40dvh,16rem)] max-w-[min(20rem,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-md border px-3 py-2 text-sm leading-relaxed text-pretty wrap-anywhere shadow-md',
          overlay ? 'z-[calc(var(--z-over-dialog)_+_2)]' : 'z-(--z-over-dialog)',
          props.class,
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
