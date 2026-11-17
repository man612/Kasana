<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import PortfolioTransferForm from '@/components/forms/portfolio-transfer-form.vue';
import type { TransferContext } from '@/composable/data-queries/portfolio-transfers';
import type { AccountModel, PortfolioModel } from '@bt/shared/types';
import { useVModel } from '@vueuse/core';
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  /** Transfer context - determines form behavior */
  context: TransferContext;
  /** Initial portfolio (when context is 'portfolio') */
  portfolio?: PortfolioModel;
  /** Initial account (when context is 'account') */
  account?: AccountModel;
  open?: boolean;
}>();

const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'update:open', value: boolean): void;
}>();

const isOpen = useVModel(props, 'open', emit, { passive: true });
const formId = useId();
const formRef = ref<InstanceType<typeof PortfolioTransferForm> | null>(null);

const handleSuccess = () => {
  isOpen.value = false;
  emit('success');
};

const handleCancel = () => {
  isOpen.value = false;
};

// Dynamic title and description based on context
const dialogTitle = computed(() =>
  props.context === 'portfolio'
    ? t('dialogs.portfolioTransfer.portfolio.title')
    : t('dialogs.portfolioTransfer.account.title'),
);
const dialogDescription = computed(() =>
  props.context === 'portfolio'
    ? t('dialogs.portfolioTransfer.portfolio.description')
    : t('dialogs.portfolioTransfer.account.description'),
);
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen">
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ dialogTitle }}</template>
    <template #description>{{ dialogDescription }}</template>

    <PortfolioTransferForm
      ref="formRef"
      :form-id="formId"
      :show-submit-button="false"
      :context="context"
      :initial-portfolio="portfolio"
      :initial-account="account"
      @success="handleSuccess"
      @cancel="handleCancel"
    />

    <template #footer>
      <UiButton type="submit" :form="formId" class="ml-auto min-w-30" :disabled="formRef?.isSubmitDisabled ?? true">
        {{
          formRef?.isSubmitting
            ? $t('forms.portfolioTransfer.submitButtonLoading')
            : $t('forms.portfolioTransfer.submitButton')
        }}
      </UiButton>
    </template>
  </ResponsiveDialog>
</template>
