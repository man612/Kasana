<template>
  <p class="text-primary-text flex min-w-0 items-start gap-1.5 text-xs leading-relaxed">
    <CheckIcon class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    <span class="min-w-0 wrap-anywhere"><slot /></span>
  </p>
</template>

<script setup lang="ts">
import { CheckIcon } from '@lucide/vue';
</script>
