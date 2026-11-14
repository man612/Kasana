<script setup lang="ts">
import { VERBOSE_PAYMENT_TYPES } from '@/common/const';
import PaymentMethodDialog from '@/components/fields/payment-method-dialog.vue';
import { useNotificationCenter } from '@/components/notification-center';
import { useAccountsStore } from '@/stores';
import type { AccountModel, PAYMENT_TYPES } from '@bt/shared/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ account: AccountModel }>();
const { t } = useI18n();
const accountsStore = useAccountsStore();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const isSaving = ref(false);
const selected = computed(
  () => VERBOSE_PAYMENT_TYPES.find((option) => option.value === props.account.defaultPaymentType) ?? null,
);
const save = async (value: (typeof VERBOSE_PAYMENT_TYPES)[number] | null) => {
  const method = (value?.value ?? null) as PAYMENT_TYPES | null;
  if (isSaving.value || method === (props.account.defaultPaymentType ?? null)) return;
  isSaving.value = true;
  try {
    await accountsStore.editAccount({ id: props.account.id, defaultPaymentType: method });
    addSuccessNotification(t('pages.account.details.defaultPaymentTypeUpdateSuccess'));
  } catch {
    addErrorNotification(t('pages.account.details.defaultPaymentTypeUpdateError'));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <PaymentMethodDialog
    icon-only
    :disabled="isSaving"
    :model-value="selected"
    :label="t('pages.account.details.editDefaultPaymentType')"
    @update:model-value="save"
  />
</template>
