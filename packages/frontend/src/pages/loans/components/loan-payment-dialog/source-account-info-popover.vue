<script lang="ts" setup>
import ContextualHelp from '@/components/common/contextual-help.vue';
import { Button } from '@/components/lib/ui/button';
</script>

<template>
  <ContextualHelp :title="$t('dialogs.loanPayment.sourceInfo.title')">
    <template #trigger>
      <Button variant="link" class="text-foreground h-auto p-0 font-medium underline decoration-dotted">
        {{ $t('dialogs.loanPayment.sourceInfo.trigger') }}
      </Button>
    </template>
    <div class="space-y-2">
      <p>{{ $t('dialogs.loanPayment.sourceInfo.manualOnly') }}</p>
      <p>{{ $t('dialogs.loanPayment.sourceInfo.whySynced') }}</p>
      <p>{{ $t('dialogs.loanPayment.sourceInfo.howToLink') }}</p>
    </div>
  </ContextualHelp>
</template>
