<script setup lang="ts">
import { cn } from '@/lib/utils';
import {
  DropdownMenuContent,
  type DropdownMenuContentEmits,
  type DropdownMenuContentProps,
  DropdownMenuPortal,
  injectDropdownMenuRootContext,
  useForwardPropsEmits,
} from 'reka-ui';

const props = withDefaults(defineProps<DropdownMenuContentProps>(), {
  sideOffset: 6,
  align: 'start',
});
const emits = defineEmits<DropdownMenuContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
const menu = injectDropdownMenuRootContext();
</script>

<template>
  <DropdownMenuPortal>
    <Transition name="lajur-info-reveal">
      <div
        v-if="menu.open.value && menu.modal.value && !menu.triggerElement.value?.closest('[role=dialog]')"
        class="lajur-scrim-menu lajur-scrim-blur pointer-events-none fixed inset-0 z-(--z-dialog)"
        aria-hidden="true"
      />
    </Transition>
    <DropdownMenuContent
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-(--z-over-dialog) max-w-[calc(100vw-1.5rem)] min-w-32 overflow-y-auto overscroll-contain rounded-md border p-1 shadow-md motion-reduce:animate-none!',
          $attrs.class ?? '',
        )
      "
      v-bind="forwarded"
      :collision-padding="12"
      :style="{ maxHeight: 'min(calc(100dvh - 1.5rem), var(--reka-dropdown-menu-content-available-height, 100dvh))' }"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
