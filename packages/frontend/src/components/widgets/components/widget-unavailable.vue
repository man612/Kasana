<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { CircleAlertIcon } from '@lucide/vue';

defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="grid justify-items-start gap-2 p-2" role="status">
    <p class="text-muted-foreground flex items-center gap-2 text-sm">
      <CircleAlertIcon class="size-4 shrink-0" aria-hidden="true" />
      {{ $t('dashboard.widgets.common.loadError') }}
    </p>
    <Button type="button" variant="outline" size="sm" @click="$emit('retry')">
      {{ $t('common.actions.retry') }}
    </Button>
  </div>
</template>
