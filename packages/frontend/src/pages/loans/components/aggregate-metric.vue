<template>
  <div
    class="grid min-w-0 content-start gap-0.5 py-1.5 @3xl/loans-aggregate:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @3xl/loans-aggregate:items-baseline @3xl/loans-aggregate:gap-2"
  >
    <div class="text-muted-foreground text-xs">
      {{ label }}
    </div>
    <div class="min-w-0 text-sm font-semibold wrap-anywhere tabular-nums @3xl/loans-aggregate:text-right">
      {{ value }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>
