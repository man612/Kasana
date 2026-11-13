<script setup lang="ts">
import { cn } from '@/lib/utils';
import { SwitchRoot, type SwitchRootEmits, type SwitchRootProps, SwitchThumb, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<SwitchRootProps & { class?: string }>();
const emits = defineEmits<SwitchRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SwitchRoot
    v-bind="forwarded"
    :class="
      cn(
        'focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center overflow-hidden rounded-full border border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        props.class,
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'bg-background dark:data-[state=unchecked]:bg-muted-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none absolute top-1/2 left-[3px] block size-4 -translate-y-1/2 rounded-full shadow-sm ring-0 transition-[left,background-color] duration-200 ease-out data-[state=checked]:left-[calc(100%-19px)] motion-reduce:transition-none',
        )
      "
    />
  </SwitchRoot>
</template>
