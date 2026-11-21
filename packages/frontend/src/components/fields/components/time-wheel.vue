<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue';

const props = defineProps<{ label: string; limit: number }>();
const value = defineModel<number>({ required: true });
const track = useTemplateRef<HTMLElement>('track');
const itemHeight = 32;
const text = (number: number) => String(number).padStart(2, '0');

function align() {
  if (!track.value) return;
  const top = value.value * itemHeight;
  // Leave the user's momentum and native snapping alone when scroll already points to this value.
  if (Math.abs(track.value.scrollTop - top) < itemHeight / 2) return;
  track.value.scrollTop = top;
}

function updateFromScroll() {
  if (!track.value?.clientHeight) return;
  value.value = Math.min(props.limit - 1, Math.max(0, Math.round(track.value.scrollTop / itemHeight)));
}

function change(next: number) {
  value.value = Math.max(0, Math.min(props.limit - 1, next));
  align();
}

onMounted(align);
watch(value, align, { flush: 'post' });
</script>

<template>
  <div class="relative min-w-0 flex-1">
    <div
      ref="track"
      role="spinbutton"
      tabindex="0"
      :aria-label="label"
      :aria-valuenow="value"
      :aria-valuetext="text(value)"
      :aria-valuemin="0"
      :aria-valuemax="limit - 1"
      class="focus-visible:ring-ring h-24 snap-y snap-mandatory [scrollbar-width:none] overflow-y-auto overscroll-contain rounded-md py-8 text-center tabular-nums focus-visible:ring-2 focus-visible:outline-none"
      @scroll.passive="updateFromScroll"
      @keydown.up.prevent="change(value + 1)"
      @keydown.down.prevent="change(value - 1)"
      @keydown.home.prevent="change(0)"
      @keydown.end.prevent="change(limit - 1)"
    >
      <div
        v-for="index in limit"
        :key="index"
        aria-hidden="true"
        class="flex h-8 snap-center items-center justify-center select-none"
        :class="index - 1 === value ? 'font-semibold' : 'text-muted-foreground'"
        @click="change(index - 1)"
      >
        {{ text(index - 1) }}
      </div>
    </div>
    <div class="border-border pointer-events-none absolute inset-x-0 top-8 h-8 rounded border-y" aria-hidden="true" />
  </div>
</template>
