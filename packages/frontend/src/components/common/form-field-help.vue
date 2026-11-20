<script setup lang="ts">
import ContextualHelp from '@/components/common/contextual-help.vue';
import { Button } from '@/components/lib/ui/button';
import { CircleHelpIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

/** Clickable explanation using the app's existing dialog/drawer pattern. */
defineProps<{ topic: string }>();

const { t } = useI18n();
</script>

<template>
  <ContextualHelp :title="t(`forms.fieldHelp.${topic}.title`)">
    <template #trigger>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-lg"
        :aria-label="t('forms.fieldHelp.open', { field: t(`forms.fieldHelp.${topic}.title`) })"
        :title="t(`forms.fieldHelp.${topic}.title`)"
      >
        <CircleHelpIcon class="size-4" />
      </Button>
    </template>
    <div class="space-y-3">
      <p>{{ t(`forms.fieldHelp.${topic}.meaning`) }}</p>
      <div class="border-primary/45 bg-muted/40 border-l-2 py-2 pr-3 pl-3">
        <p class="mb-0.5 font-semibold">{{ t('forms.fieldHelp.example') }}</p>
        <p class="text-muted-foreground">{{ t(`forms.fieldHelp.${topic}.example`) }}</p>
      </div>
      <div class="text-muted-foreground">
        <p class="text-foreground mb-0.5 font-semibold">{{ t('forms.fieldHelp.important') }}</p>
        <p>{{ t(`forms.fieldHelp.${topic}.important`) }}</p>
      </div>
    </div>
  </ContextualHelp>
</template>
