<template>
  <div
    role="group"
    :aria-label="t('dialogs.manageTransaction.title')"
    class="bg-muted relative grid grid-cols-3 rounded-xl p-1"
    data-testid="transaction-type-switcher"
  >
    <span
      aria-hidden="true"
      data-testid="transaction-type-indicator"
      class="dark:bg-foreground pointer-events-none absolute inset-y-1 left-1 rounded-[10px] bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
      :style="{
        width: 'calc(33.33333% - 0.166667rem)',
        transform: 'translateX(' + selectedIndex * 100 + '%)',
      }"
    />
    <button
      v-for="option in txOptions"
      :key="option.type"
      type="button"
      :class="
        cn(
          'relative z-10 cursor-pointer rounded-[10px] p-1.5 text-center text-base font-medium transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
          selectedTransactionType === option.type
            ? 'text-foreground dark:text-background'
            : 'text-muted-foreground hover:text-foreground',
        )
      "
      :disabled="
        disabled ||
        (option.type === FORM_TYPES.expense && isExpenseDisabled) ||
        (option.type === FORM_TYPES.income && isIncomeDisabled) ||
        (option.type === FORM_TYPES.transfer && isTransferDisabled) ||
        isLockedOut({ type: option.type })
      "
      :aria-label="t(option.aria)"
      :aria-pressed="selectedTransactionType === option.type"
      @click="selectTransactionType(option.type)"
    >
      {{ t(option.label) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils';
import { ACCOUNT_TYPES, type AccountModel, TRANSACTION_TYPES, type TransactionModel } from '@bt/shared/types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { FORM_TYPES } from '../types';

const { t } = useI18n();
const txOptions = [
  {
    type: FORM_TYPES.expense,
    label: 'dialogs.manageTransaction.typeSelector.expense',
    aria: 'dialogs.manageTransaction.typeSelector.selectExpense',
  },
  {
    type: FORM_TYPES.income,
    label: 'dialogs.manageTransaction.typeSelector.income',
    aria: 'dialogs.manageTransaction.typeSelector.selectIncome',
  },
  {
    type: FORM_TYPES.transfer,
    label: 'dialogs.manageTransaction.typeSelector.transfer',
    aria: 'dialogs.manageTransaction.typeSelector.selectTransfer',
  },
] as const;

const props = defineProps<{
  selectedTransactionType: FORM_TYPES;
  transaction?: TransactionModel;
  account?: AccountModel;
  disabled?: boolean;
  /** Planned rows must stay standalone, so transfer is off the table while the mode is on. */
  isTransferDisabled?: boolean;
  /** Only the selected type stays enabled. */
  isTypeLocked?: boolean;
}>();

const selectedIndex = computed(() =>
  Math.max(
    0,
    txOptions.findIndex((option) => option.type === props.selectedTransactionType),
  ),
);
const isLockedOut = ({ type }: { type: FORM_TYPES }) =>
  Boolean(props.isTypeLocked) && props.selectedTransactionType !== type;

const emit = defineEmits<{
  'change-tx-type': [value: FORM_TYPES];
}>();

// Check the account type, not the transaction type
// A system transaction in a monobank account should not be editable
const isExpenseDisabled = computed(
  () => props.account?.type !== ACCOUNT_TYPES.system && props.transaction?.transactionType === TRANSACTION_TYPES.income,
);
const isIncomeDisabled = computed(
  () =>
    props.account?.type !== ACCOUNT_TYPES.system && props.transaction?.transactionType === TRANSACTION_TYPES.expense,
);

const selectTransactionType = (type: FORM_TYPES) => {
  emit('change-tx-type', type);
};
</script>
