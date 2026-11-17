<script setup lang="ts">
import { ACCOUNT_CATEGORIES_TRANSLATION_KEYS } from '@/common/const';
import OptionPickerDialog from '@/components/fields/option-picker-dialog.vue';
import { useNotificationCenter } from '@/components/notification-center';
import { getAccountTypeIcon, getAccountTypeTintedChipClass } from '@/pages/accounts/account-type-presentation';
import { useAccountsStore } from '@/stores';
import { ACCOUNT_CATEGORIES, type AccountModel, isDedicatedFlowAccountCategory } from '@bt/shared/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ account: AccountModel }>();
const { t } = useI18n();
const accountsStore = useAccountsStore();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const isSaving = ref(false);

const options = computed(() =>
  Object.values(ACCOUNT_CATEGORIES)
    // Loan and vehicle accounts need dedicated sidecar data and cannot switch through generic edit.
    .filter((category) => !isDedicatedFlowAccountCategory(category))
    .map((category) => ({
      value: category,
      label: t(ACCOUNT_CATEGORIES_TRANSLATION_KEYS[category]),
      icon: getAccountTypeIcon({ category }),
      iconClass: getAccountTypeTintedChipClass({ category }),
    })),
);

const save = async (value: string) => {
  if (isSaving.value || value === props.account.accountCategory) return;
  isSaving.value = true;
  try {
    await accountsStore.editAccount({ id: props.account.id, accountCategory: value as ACCOUNT_CATEGORIES });
    addSuccessNotification(t('pages.account.details.accountCategoryUpdateSuccess'));
  } catch {
    addErrorNotification(t('pages.account.details.accountCategoryUpdateError'));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <OptionPickerDialog
    icon-only
    :disabled="isSaving"
    :model-value="account.accountCategory"
    :options="options"
    :label="t('pages.account.details.editAccountCategory')"
    :placeholder="t('pages.account.details.accountCategory')"
    @update:model-value="save"
  />
</template>
