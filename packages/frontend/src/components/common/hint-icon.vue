<script setup lang="ts">
import ContextualHelp from '@/components/common/contextual-help.vue';
import { Button } from '@/components/lib/ui/button';
import { CircleHelpIcon } from '@lucide/vue';

defineProps<{ content: string; title?: string; example?: string; compact?: boolean }>();
</script>

<template>
  <ContextualHelp :content="content" :title="title" :example="example" :compact="compact">
    <template #trigger>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-full"
        :aria-label="title || $t('common.contextHelp.title')"
      >
        <CircleHelpIcon class="size-4" aria-hidden="true" />
      </Button>
    </template>
  </ContextualHelp>
</template>
