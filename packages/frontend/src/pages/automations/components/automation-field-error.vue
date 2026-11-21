<template>
  <LayoutCollapse :open="Boolean(errorMessage)">
    <p :class="cn('text-destructive-text mt-1 ml-2 text-xs', attrs.class as string)" role="alert">
      {{ displayedMessage }}
    </p>
  </LayoutCollapse>
</template>

<script lang="ts" setup>
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { cn } from '@/lib/utils';
import { ref, useAttrs, watch } from 'vue';

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

const props = defineProps<{
  errorMessage?: string | null;
}>();

const displayedMessage = ref(props.errorMessage);
watch(
  () => props.errorMessage,
  (message) => {
    if (message) displayedMessage.value = message;
  },
);
</script>
