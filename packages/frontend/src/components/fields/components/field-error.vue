<template>
  <LayoutCollapse v-if="animated" :open="Boolean(errorMessage)">
    <p class="text-destructive-text mt-1 ml-2 text-xs" role="alert">{{ visibleMessage }}</p>
  </LayoutCollapse>
  <Transition v-else name="kasana-feedback">
    <p v-if="errorMessage" :class="cn('text-destructive-text mt-1 ml-2 text-xs', attrs.class as string)">
      {{ errorMessage }}
    </p>
  </Transition>
</template>

<script lang="ts" setup>
import { cn } from '@/lib/utils';
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { ref, useAttrs, watch } from 'vue';

const attrs = useAttrs();

const props = defineProps<{
  animated?: boolean;
  errorMessage?: string | null;
}>();
const visibleMessage = ref(props.errorMessage);
watch(
  () => props.errorMessage,
  (message) => {
    if (message) visibleMessage.value = message;
  },
);
</script>
