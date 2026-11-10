<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { CircleHelpIcon } from '@lucide/vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** Clickable explanation using the app's existing dialog/drawer pattern. */
defineProps<{ topic: string }>();

const { t } = useI18n();
const isOpen = ref(false);
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen">
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
    <template #title>{{ t(`forms.fieldHelp.${topic}.title`) }}</template>
    <template #description>{{ t('forms.fieldHelp.description') }}</template>
    <div class="space-y-4 px-1 pb-3 text-sm leading-relaxed">
      <p class="text-foreground">{{ t(`forms.fieldHelp.${topic}.meaning`) }}</p>
      <div class="border-border bg-muted/40 rounded-xl border p-3">
        <p class="text-foreground mb-1 font-semibold">{{ t('forms.fieldHelp.example') }}</p>
        <p class="text-muted-foreground">{{ t(`forms.fieldHelp.${topic}.example`) }}</p>
      </div>
      <div class="border-border rounded-xl border p-3">
        <p class="text-foreground mb-1 font-semibold">{{ t('forms.fieldHelp.important') }}</p>
        <p class="text-muted-foreground">{{ t(`forms.fieldHelp.${topic}.important`) }}</p>
      </div>
    </div>
  </ResponsiveDialog>
</template>
