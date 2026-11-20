<script setup lang="ts">
import ContextualHelp from '@/components/common/contextual-help.vue';
import { Button } from '@/components/lib/ui/button';
import { CircleHelpIcon, LightbulbIcon } from '@lucide/vue';

defineProps<{ compactTrigger?: boolean }>();
</script>

<template>
  <ContextualHelp :title="$t('automations.guide.title')">
    <template #trigger>
      <Button
        type="button"
        :size="compactTrigger ? 'icon' : 'sm'"
        :variant="compactTrigger ? 'ghost' : 'soft-primary'"
        :aria-label="compactTrigger ? $t('automations.guide.title') : undefined"
        class="shrink-0"
      >
        <component :is="compactTrigger ? CircleHelpIcon : LightbulbIcon" class="size-4" aria-hidden="true" />
        <template v-if="!compactTrigger">{{ $t('automations.mcpTip.trigger') }}</template>
      </Button>
    </template>
    <p>{{ $t('automations.guide.intro') }}</p>
    <ol class="list-decimal space-y-2 pl-5">
      <li>{{ $t('automations.guide.choose') }}</li>
      <li>{{ $t('automations.guide.act') }}</li>
      <li>{{ $t('automations.guide.check') }}</li>
    </ol>
    <div class="border-primary/45 bg-muted/40 space-y-1 border-l-2 p-3">
      <p class="font-semibold">{{ $t('automations.guide.exampleTitle') }}</p>
      <p>{{ $t('automations.guide.example') }}</p>
      <p>{{ $t('automations.guide.exampleRun') }}</p>
    </div>
    <p>{{ $t('automations.guide.noMatch') }}</p>
    <p>{{ $t('automations.guide.schedule') }}</p>
    <p class="text-muted-foreground">{{ $t('automations.guide.caution') }}</p>
    <slot />
  </ContextualHelp>
</template>
