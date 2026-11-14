<script setup lang="ts">
import { cn } from '@/lib/utils';
import {
  DropdownMenuContent,
  type DropdownMenuContentEmits,
  type DropdownMenuContentProps,
  DropdownMenuPortal,
  useForwardPropsEmits,
} from 'reka-ui';

const props = withDefaults(defineProps<DropdownMenuContentProps>(), {
  sideOffset: 6,
  align: 'start',
});
const emits = defineEmits<DropdownMenuContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-(--z-dialog) min-w-32 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border p-1 shadow-md',
          $attrs.class ?? '',
        )
      "
      v-bind="forwarded"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
