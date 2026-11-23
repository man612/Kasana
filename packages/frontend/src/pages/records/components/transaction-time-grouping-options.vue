<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { TRANSACTION_TIME_GROUPINGS, type TransactionTimeGrouping } from '@bt/shared/types';
import { Switch } from '@/components/lib/ui/switch';
import { CheckIcon, Clock3Icon } from '@lucide/vue';
import { computed, useId } from 'vue';

const props = defineProps<{ unavailable?: boolean; hideGrouping?: boolean }>();
const emit = defineEmits<{ selected: [] }>();
const mode = defineModel<TransactionTimeGrouping>({ required: true });
const showTime = defineModel<boolean>('showTime', { required: true });
const isTimeRequired = computed(() => mode.value === 'day' && !props.unavailable && !props.hideGrouping);
const labelId = useId();
const timeReasonId = useId();
const choose = (option: TransactionTimeGrouping) => {
  mode.value = option;
  emit('selected');
};
</script>

<template>
  <div
    class="border-border space-y-1 border-b p-1 pb-2"
    role="group"
    :aria-labelledby="hideGrouping ? undefined : labelId"
  >
    <p v-if="!hideGrouping" :id="labelId" class="text-muted-foreground px-2 text-xs font-semibold">
      {{ $t('transactions.timeGrouping.title') }}
    </p>
    <p v-if="unavailable && !hideGrouping" class="text-muted-foreground px-2 text-xs">
      {{ $t('transactions.timeGrouping.chronologicalOnly') }}
    </p>
    <Button
      v-for="option in hideGrouping ? [] : TRANSACTION_TIME_GROUPINGS"
      :key="option"
      variant="ghost"
      class="min-h-10 w-full justify-start gap-2 font-normal"
      :aria-pressed="mode === option"
      :disabled="unavailable"
      @click="choose(option)"
    >
      <CheckIcon
        class="size-4 transition-opacity motion-reduce:transition-none"
        :class="mode === option ? 'opacity-100' : 'opacity-0'"
      />
      {{ $t(`transactions.timeGrouping.${option}`) }}
    </Button>
    <label class="flex min-h-11 items-center gap-2 px-2 text-sm" :for="timeReasonId + '-switch'">
      <Clock3Icon class="text-muted-foreground size-4" aria-hidden="true" />
      <span class="flex-1">{{ $t('transactions.timeGrouping.showTime') }}</span>
      <Switch
        :id="timeReasonId + '-switch'"
        :model-value="isTimeRequired || showTime"
        :disabled="isTimeRequired"
        :aria-describedby="isTimeRequired ? timeReasonId : undefined"
        @update:model-value="showTime = $event"
      />
    </label>
    <p v-if="isTimeRequired" :id="timeReasonId" class="sr-only">
      {{ $t('transactions.timeGrouping.timeRequired') }}
    </p>
  </div>
</template>
