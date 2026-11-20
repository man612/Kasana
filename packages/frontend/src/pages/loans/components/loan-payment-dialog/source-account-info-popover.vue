<script lang="ts" setup>
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { ref } from 'vue';

const isOpen = ref(false);
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen" raised mobile-presentation="center">
    <template #trigger>
      <Button variant="link" class="text-foreground h-auto p-0 font-medium underline decoration-dotted">
        {{ $t('dialogs.loanPayment.sourceInfo.trigger') }}
      </Button>
    </template>
    <template #title>{{ $t('dialogs.loanPayment.sourceInfo.title') }}</template>
    <template #description>{{ $t('dialogs.loanPayment.sourceInfo.manualOnly') }}</template>
    <div class="text-muted-foreground space-y-2 px-1 text-sm">
      <p>{{ $t('dialogs.loanPayment.sourceInfo.whySynced') }}</p>
      <p>{{ $t('dialogs.loanPayment.sourceInfo.howToLink') }}</p>
    </div>
  </ResponsiveDialog>
</template>
