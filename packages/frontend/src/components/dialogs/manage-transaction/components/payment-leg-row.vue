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
}>();

const emit = defineEmits<{
  'update:account': [value: AccountModel | null];
  'update:amount': [value: string | number | null];
  'amount-blur': [];
}>();

const amountFieldRef = ref<InstanceType<typeof FormattedAmountField> | null>(null);

defineExpose({
  focus: () => amountFieldRef.value?.focus(),
  select: () => amountFieldRef.value?.select(),
});
</script>

<template>
  <div class="@container">
    <div class="flex min-w-0 items-start gap-1.5">
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
            @update:model-value="emit('update:account', $event)"
          />
          <slot name="account-addon" />
        </div>

        <div class="border-input flex min-w-0 flex-[3] items-center border-l pr-1 pl-1 [&_input]:px-1.5">
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
            :disabled="disabled || locked"
            @update:model-value="emit('update:amount', $event)"
            @blur="emit('amount-blur')"
          />
          <CurrencyChip v-if="currencyCode && currencyCode !== 'IDR'" :code="currencyCode" />
        </div>

        <div
          v-if="$slots.converted"
          class="border-input flex min-w-0 flex-[2] items-center gap-1 border-l pr-1 pl-2 [&_input]:px-1"
        >
          <slot name="converted" />
        </div>
      </div>
      <div v-if="$slots.actions" class="flex size-9 shrink-0 items-center justify-end">
        <slot name="actions" />
      </div>
    </div>
    <FieldError :error-message="errorMessage" />
  </div>
</template>
