<script setup lang="ts">
import ContextualHelp from '@/components/common/contextual-help.vue';
import { Button } from '@/components/lib/ui/button';
import { CircleHelpIcon } from '@lucide/vue';

defineProps<{ feature: 'transfers' | 'aiCategorization' | 'reconciliation' | 'applyRules' }>();
</script>

<template>
  <ContextualHelp
    :title="$t(`optimizations.cards.${feature}.title`)"
    :content="$t(`optimizations.help.${feature}.body`)"
    :example="$t(`optimizations.help.${feature}.example`)"
  >
    <template #trigger>
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground shrink-0"
        :aria-label="$t('optimizations.help.label')"
      >
        <CircleHelpIcon class="size-4" />
      </Button>
    </template>
  </ContextualHelp>
</template>
