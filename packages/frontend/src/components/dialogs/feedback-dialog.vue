<template>
  <ResponsiveDialog v-model:open="isOpen">
    <template #trigger><slot /></template>
    <template #title>{{ $t('feedback.dialog.title') }}</template>
    <template #description>{{ $t('kasana.feedback.githubOnly') }}</template>
    <div class="grid gap-4">
      <p class="text-muted-foreground text-sm leading-relaxed">
        {{ $t('kasana.feedback.privacyWarning') }}
      </p>
      <UiButton
        as="a"
        href="https://github.com/man612/Kasana/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
        class="w-full"
      >
        {{ $t('kasana.feedback.openIssues') }}
      </UiButton>
    </div>
  </ResponsiveDialog>
</template>

<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { ref } from 'vue';

// Do not transmit free-text financial or support feedback to analytics.
// Kasana has no hosted feedback inbox; direct reports to its own issue tracker.
const isOpen = ref(false);
</script>
