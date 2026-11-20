<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps({
  class: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <div
    :class="
      cn(
        'mt-3.5 flex items-stretch justify-end gap-2 [&>button]:h-auto [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:wrap-anywhere [&>button]:whitespace-normal max-sm:[&>button]:flex-1',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
