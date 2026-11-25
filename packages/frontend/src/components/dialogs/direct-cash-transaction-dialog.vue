<script setup lang="ts">
import { useId, useTemplateRef } from 'vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import DirectCashTransactionForm from '@/components/forms/direct-cash-transaction-form.vue';
import type { PortfolioModel } from '@bt/shared/types';
import { useVModel } from '@vueuse/core';

const props = defineProps<{
  portfolioId: string;
  portfolio: PortfolioModel;
  open?: boolean;
}>();

const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'update:open', value: boolean): void;
}>();

const isOpen = useVModel(props, 'open', emit, { passive: true });

const handleSuccess = () => {
  isOpen.value = false;
  emit('success');
};

const handleCancel = () => {
  isOpen.value = false;
};
const formId = useId();
const actionForm = useTemplateRef<InstanceType<typeof DirectCashTransactionForm>>('action-form');
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen" custom-close centered-title fit-keyboard>
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ $t('dialogs.directCashTransaction.title') }}</template>

    <DirectCashTransactionForm
      ref="action-form"
      :form-id="formId"
      :portfolio-id="props.portfolioId"
      :portfolio="props.portfolio"
      @success="handleSuccess"
      @cancel="handleCancel"
    />
    <template #footer>
      <UiButton type="button" variant="secondary" :disabled="actionForm?.isSubmitting" @click="handleCancel">
        {{ $t('forms.directCashTransaction.cancelButton') }}
      </UiButton>
      <UiButton type="submit" :form="formId" :disabled="actionForm?.isSubmitDisabled ?? true">
        {{
          actionForm?.isSubmitting
            ? $t('forms.directCashTransaction.submitButtonLoading')
            : $t('forms.directCashTransaction.submitButton')
        }}
      </UiButton>
    </template>
  </ResponsiveDialog>
</template>
