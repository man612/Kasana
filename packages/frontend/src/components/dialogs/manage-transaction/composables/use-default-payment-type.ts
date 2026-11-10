import { VERBOSE_PAYMENT_TYPES, type VerbosePaymentType } from '@/common/const';
import { useUserSettings } from '@/composable/data-queries/user-settings';
import type { PAYMENT_TYPES } from '@bt/shared/types';
import { computed } from 'vue';

/** Read/write access to the payment type preselected on new transactions. */
export const useDefaultPaymentType = () => {
  const { data: userSettings, patchAsync, isPatching } = useUserSettings();

  const defaultPaymentType = computed<VerbosePaymentType | null>(() => {
    // No invented payment method: the account's own preference takes priority.
    // Without any preference, leave the method unselected rather than assuming credit card.
    const value = userSettings.value?.ui?.transactionForm?.defaultPaymentType;
    return VERBOSE_PAYMENT_TYPES.find((item) => item.value === value) ?? null;
  });

  const setDefaultPaymentType = ({ value }: { value: PAYMENT_TYPES }) =>
    patchAsync({ ui: { transactionForm: { defaultPaymentType: value } } });

  return { defaultPaymentType, setDefaultPaymentType, isUpdating: isPatching };
};
