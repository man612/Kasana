<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { XIcon } from '@lucide/vue';

defineProps<{ label: string; disabled?: boolean }>();
defineEmits<{ remove: [] }>();
</script>

<template>
  <Button
    type="button"
    size="icon-sm"
    variant="ghost"
    class="text-muted-foreground hover:text-destructive-text size-6 shrink-0 rounded-md"
    :disabled="disabled"
    :aria-label="$t('kasana.optionalFields.removeNamed', { name: label })"
    :title="$t('kasana.optionalFields.removeNamed', { name: label })"
    @click="$emit('remove')"
  >
    <XIcon class="size-3.5" />
  </Button>
</template>
