<script setup lang="ts">
import { useDateLocale } from '@/composable/use-date-locale';
import { useDocumentVisibility, useElementVisibility, useIntervalFn } from '@vueuse/core';
import { computed, shallowRef, useTemplateRef, watch } from 'vue';

const props = defineProps<{ value: Date; live: boolean }>();
const { format } = useDateLocale();
const visibility = useDocumentVisibility();
const labelElement = useTemplateRef<HTMLElement>('labelElement');
const inView = useElementVisibility(labelElement);
const now = shallowRef(new Date());
const tick = () => {
  now.value = new Date();
};
const { pause, resume } = useIntervalFn(tick, 1000, { immediate: false, immediateCallback: true });
watch(
  () => props.live && visibility.value === 'visible' && inView.value,
  (running) => {
    if (running) resume();
    else pause();
  },
  { immediate: true },
);

const label = computed(() => {
  const date = props.live ? now.value : props.value;
  return format(date, 'EEEE, d MMMM yyyy · HH:mm:ss');
});
</script>

<template>
  <span ref="labelElement" class="min-w-0 text-left leading-snug whitespace-normal tabular-nums">{{ label }}</span>
</template>
