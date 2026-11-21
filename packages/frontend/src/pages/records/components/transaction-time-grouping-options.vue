<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { TRANSACTION_TIME_GROUPINGS, type TransactionTimeGrouping } from '@bt/shared/types';
import { CheckIcon } from '@lucide/vue';
import { useId } from 'vue';

defineProps<{ unavailable?: boolean }>();
const mode = defineModel<TransactionTimeGrouping>({ required: true });
const labelId = useId();
</script>

<template>
  <div class="border-border space-y-1 border-b px-1 pt-1 pb-2" role="group" :aria-labelledby="labelId">
    <p :id="labelId" class="text-muted-foreground px-2 text-xs font-semibold">
      {{ $t('transactions.timeGrouping.title') }}
    </p>
    <p v-if="unavailable" class="text-muted-foreground px-2 text-xs">
      {{ $t('transactions.timeGrouping.chronologicalOnly') }}
    </p>
    <Button
      v-for="option in TRANSACTION_TIME_GROUPINGS"
      :key="option"
      variant="ghost"
      class="min-h-10 w-full justify-start gap-2 font-normal"
      :aria-pressed="mode === option"
      :disabled="unavailable"
      @click="mode = option"
    >
      <CheckIcon
        class="size-4 transition-opacity motion-reduce:transition-none"
        :class="mode === option ? 'opacity-100' : 'opacity-0'"
      />
      {{ $t(`transactions.timeGrouping.${option}`) }}
    </Button>
  </div>
</template>
