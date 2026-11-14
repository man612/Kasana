<script setup lang="ts">
import CurrencyChip from '@/components/common/currency-chip.vue';
import AccountSelectField from '@/components/fields/account-select-field.vue';
import FieldError from '@/components/fields/components/field-error.vue';
import FormattedAmountField from '@/components/fields/formatted-amount-field.vue';
import { cn } from '@/lib/utils';
import type { AccountModel } from '@bt/shared/types';
import { ref } from 'vue';

defineProps<{
  account: AccountModel | null;
  accounts: AccountModel[];
  accountPlaceholder: string;
  amount: number | null;
  currencyCode?: string;
  /** Account and amount can't change here: a linked or bank-synced row. */
  locked?: boolean;
  disabled?: boolean;
  errorMessage?: string;
  requireAccountBeforeAmount?: boolean;
}>();

const emit = defineEmits<{
  'update:account': [value: AccountModel | null];
  'update:amount': [value: string | number | null];
  'amount-blur': [];
}>();

const amountFieldRef = ref<InstanceType<typeof FormattedAmountField> | null>(null);
const accountWarningVisible = ref(false);
const requireAccountChoice = () => {
  // The user asked for guidance, not a nested account dropdown that may close the form on Escape.
  accountWarningVisible.value = true;
};
const onAccountPicked = (value: AccountModel | null) => {
  accountWarningVisible.value = false;
  emit('update:account', value);
};

defineExpose({
  focus: () => amountFieldRef.value?.focus(),
  select: () => amountFieldRef.value?.select(),
});
</script>

<template>
  <div class="@container">
    <div class="flex min-w-0 items-start gap-1">
      <div
        :class="
          cn(
            'border-input bg-input-background focus-within:border-ring flex h-10 min-w-0 flex-1 items-stretch overflow-hidden rounded-md border md:h-9',
            errorMessage && 'border-destructive',
          )
        "
      >
        <div class="flex min-w-0 flex-[2] items-center overflow-hidden">
          <AccountSelectField
            class="min-w-0 flex-1"
            embedded
            :model-value="account"
            :accounts="accounts"
            :placeholder="accountPlaceholder"
            :disabled="disabled || locked"
            @update:model-value="onAccountPicked"
          />
          <slot name="account-addon" />
        </div>

        <div class="border-input relative flex min-w-0 flex-[3] items-center border-l pr-1 pl-1 [&_input]:px-1.5">
          <span v-if="currencyCode === 'IDR'" class="text-muted-foreground shrink-0 pl-1 text-xs font-semibold"
            >Rp</span
          >
          <FormattedAmountField
            ref="amountFieldRef"
            class="min-w-0 flex-1"
            :model-value="amount"
            embedded
            :placeholder="$t('dialogs.manageTransaction.form.amountPlaceholder')"
            :aria-label="$t('dialogs.manageTransaction.form.amountLabel')"
            :disabled="disabled || locked || (requireAccountBeforeAmount && !account)"
            @update:model-value="emit('update:amount', $event)"
            @blur="emit('amount-blur')"
          />
          <CurrencyChip v-if="currencyCode && currencyCode !== 'IDR'" :code="currencyCode" />
          <button
            v-if="requireAccountBeforeAmount && !account && !disabled && !locked"
            type="button"
            class="focus-visible:ring-ring absolute inset-0 z-10 cursor-pointer rounded-r-md focus-visible:ring-2"
            :aria-label="$t('dialogs.manageTransaction.form.paymentLegs.chooseAccountFirst')"
            @click="requireAccountChoice"
          />
        </div>

        <div
          v-if="$slots.converted"
          class="border-input flex min-w-0 flex-[2] items-center gap-1 border-l pr-1 pl-2 [&_input]:px-1"
        >
          <slot name="converted" />
        </div>
      </div>
      <div v-if="$slots.actions" class="flex size-7 shrink-0 items-center justify-center pt-1">
        <slot name="actions" />
      </div>
    </div>
    <FieldError :error-message="errorMessage" />
    <p v-if="accountWarningVisible && !account" class="text-warning-text mt-1 text-xs" role="status">
      {{ $t('dialogs.manageTransaction.form.paymentLegs.chooseAccountFirst') }}
    </p>
  </div>
</template>
