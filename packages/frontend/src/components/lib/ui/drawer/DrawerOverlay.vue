<script lang="ts" setup>
import { cn } from '@/lib/utils';
import type { DialogOverlayProps } from 'reka-ui';
import { DrawerOverlay } from 'vaul-vue';
import { type HtmlHTMLAttributes, computed } from 'vue';

const props = defineProps<DialogOverlayProps & { class?: HtmlHTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { class: _, ...delegated } = props;

  return delegated;
});
</script>

<template>
  <DrawerOverlay
    v-bind="delegatedProps"
    data-lajur-backdrop
    @click.prevent
    :class="
      cn('lajur-scrim-dialog lajur-scrim-blur fixed inset-0 z-(--z-dialog) motion-reduce:animate-none!', props.class)
    "
  />
</template>
