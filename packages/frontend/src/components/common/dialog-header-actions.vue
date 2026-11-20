<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { XIcon } from '@lucide/vue';

defineProps<{ close?: () => void }>();
</script>

<template>
  <div class="flex shrink-0 items-start">
    <slot />
    <Button
      v-if="close"
      type="button"
      variant="ghost"
      size="icon"
      class="text-muted-foreground size-11"
      :aria-label="$t('common.ui.close')"
      @click="close"
    >
      <XIcon class="size-5" aria-hidden="true" />
    </Button>
  </div>
</template>
