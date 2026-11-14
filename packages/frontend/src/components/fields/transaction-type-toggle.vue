<script setup lang="ts">
import { cn } from '@/lib/utils';
import { TRANSACTION_TYPES } from '@bt/shared/types';
import { ArrowDownIcon, ArrowUpIcon } from '@lucide/vue';

const model = defineModel<TRANSACTION_TYPES>({ required: true });

defineProps<{
  expenseLabel?: string;
  incomeLabel?: string;
  disabled?: boolean;
}>();

const BASE_CLASSES =
  'focus-visible:ring-ring relative z-10 flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';
</script>

<template>
  <div class="bg-muted/50 border-border/50 relative flex w-full rounded-lg border p-1">
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md shadow-sm transition-[transform,background-color] duration-250 ease-out motion-reduce:transition-none"
      :class="
        model === TRANSACTION_TYPES.expense ? 'bg-app-expense-color/15' : 'bg-app-income-color/15 translate-x-full'
      "
    />
    <button
      type="button"
      :aria-pressed="model === TRANSACTION_TYPES.expense"
      :disabled="disabled"
      :class="
        cn(
          BASE_CLASSES,
          model === TRANSACTION_TYPES.expense
            ? 'text-app-expense-color font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )
      "
      @click="model = TRANSACTION_TYPES.expense"
    >
      <ArrowUpIcon class="size-4" />
      {{ expenseLabel ?? $t('dialogs.manageTransaction.typeSelector.expense') }}
    </button>
    <button
      type="button"
      :aria-pressed="model === TRANSACTION_TYPES.income"
      :disabled="disabled"
      :class="
        cn(
          BASE_CLASSES,
          model === TRANSACTION_TYPES.income
            ? 'text-app-income-color font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )
      "
      @click="model = TRANSACTION_TYPES.income"
    >
      <ArrowDownIcon class="size-4" />
      {{ incomeLabel ?? $t('dialogs.manageTransaction.typeSelector.income') }}
    </button>
  </div>
</template>
