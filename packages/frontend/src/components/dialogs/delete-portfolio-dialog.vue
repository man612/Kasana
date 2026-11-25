<template>
  <ResponsiveAlertDialog
    v-model:open="isOpen"
    :confirm-label="$t('dialogs.deletePortfolio.deleteButton')"
    confirm-variant="destructive"
    :confirm-loading="deletePortfolioMutation.isPending.value"
    @confirm="handleDelete"
  >
    <template v-if="$slots.default" #trigger><slot /></template>
    <template #title>{{ $t('dialogs.deletePortfolio.title') }}</template>
    <template #description>{{
      $t('dialogs.deletePortfolio.description', { days: PORTFOLIO_TRASH_RETENTION_DAYS })
    }}</template>
  </ResponsiveAlertDialog>
</template>

<script setup lang="ts">
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import { useNotificationCenter } from '@/components/notification-center';
import { useDeletePortfolio } from '@/composable/data-queries/portfolios';
import { ApiErrorResponseError } from '@/js/errors';
import { PORTFOLIO_TRASH_RETENTION_DAYS } from '@bt/shared/types';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  portfolioId: string;
}>();

const emit = defineEmits<{
  (e: 'deleted'): void;
}>();

const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const deletePortfolioMutation = useDeletePortfolio();
const isOpen = defineModel<boolean>('open', { default: false });

const handleDelete = async () => {
  try {
    await deletePortfolioMutation.mutateAsync(props.portfolioId);
    addSuccessNotification(t('dialogs.deletePortfolio.notifications.success'));
    isOpen.value = false;
    emit('deleted');
  } catch (e) {
    const message =
      e instanceof ApiErrorResponseError && e.data?.message
        ? e.data.message
        : t('dialogs.deletePortfolio.notifications.error');
    addErrorNotification(message);
  }
};
</script>
