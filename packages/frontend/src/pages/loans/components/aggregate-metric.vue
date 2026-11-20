<template>
  <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-2 py-2">
    <div class="text-muted-foreground text-sm">
      {{ label }}
    </div>
    <div class="min-w-0 text-right text-sm font-semibold wrap-anywhere tabular-nums">{{ value }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>
