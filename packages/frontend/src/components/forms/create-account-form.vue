<script setup lang="ts">
import { createAccount } from '@/api';
import {
  NO_PAYMENT_TYPE_OPTION,
  NULLABLE_PAYMENT_TYPE_OPTIONS,
  VERBOSE_PAYMENT_TYPES,
  type VerbosePaymentType,
  type NullablePaymentTypeOption,
  VUE_QUERY_GLOBAL_PREFIXES,
} from '@/common/const';
import { ACCOUNT_CATEGORIES_TRANSLATION_KEYS } from '@/common/const/account-categories-verbose';
import AccountLogo from '@/components/common/account-logo.vue';
import { type LogoSelection, toOptionalLogoPayload } from '@/components/common/logo-selection';
import LogoSquareField from '@/components/common/logo-square-field.vue';
import FormFieldHelp from '@/components/common/form-field-help.vue';
import InputField from '@/components/fields/input-field.vue';
import FormattedAmountField from '@/components/fields/formatted-amount-field.vue';
import OptionPickerDialog from '@/components/fields/option-picker-dialog.vue';
import { getAccountTypeIcon, getAccountTypeTintedChipClass } from '@/pages/accounts/account-type-presentation';
import PaymentMethodDialog from '@/components/fields/payment-method-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useFormValidation } from '@/composable/form-validator';
import * as validators from '@/js/helpers/validators';
import { trackAnalyticsEvent } from '@/lib/posthog';
import { useCurrenciesStore } from '@/stores';
import { useOnboardingStore } from '@/stores/onboarding';
import { ACCOUNT_CATEGORIES, isDedicatedFlowAccountCategory } from '@bt/shared/types';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const props = withDefaults(defineProps<{ formId?: string; showSubmitButton?: boolean }>(), {
  showSubmitButton: true,
});
const emit = defineEmits(['created']);

const { t } = useI18n();
const route = useRoute();
const queryClient = useQueryClient();
const currenciesStore = useCurrenciesStore();
const { addNotification } = useNotificationCenter();

const { baseCurrency, systemCurrenciesVerbose } = storeToRefs(currenciesStore);

const defaultCurrency = computed(
  () =>
    baseCurrency.value?.currencyCode ??
    systemCurrenciesVerbose.value.linked.find((currency) => currency.code === 'IDR')?.code ??
    systemCurrenciesVerbose.value.linked[0]?.code ??
    '',
);

const queryCategory = route.query.category as ACCOUNT_CATEGORIES | undefined;
const defaultAccountCategory =
  queryCategory &&
  Object.hasOwn(ACCOUNT_CATEGORIES_TRANSLATION_KEYS, queryCategory) &&
  !isDedicatedFlowAccountCategory(queryCategory)
    ? queryCategory
    : ACCOUNT_CATEGORIES.general;

const form = reactive<{
  name: string;
  accountCategory: ACCOUNT_CATEGORIES;
  defaultPaymentType: NullablePaymentTypeOption | null;
  initialBalance: number | null;
  creditLimit: number | null;
  /** Chosen brand or monogram. null = no logo; the account renders its account-type chip (accounts have no auto-resolution). */
  logo: LogoSelection | null;
}>({
  name: '',
  accountCategory: defaultAccountCategory,
  defaultPaymentType: NO_PAYMENT_TYPE_OPTION,
  initialBalance: 0,
  creditLimit: 0,
  logo: null,
});

const { isFormValid, touchField, getFieldErrorMessage } = useFormValidation(
  { form },
  { form: { name: { required: validators.required } } },
);

const logoPlaceholderAccount = computed(() => ({
  name: form.name,
  logoDomain: null,
  logoInitials: null,
  logoColor: null,
  logoIcon: null,
  logoImageId: null,
  accountCategory: form.accountCategory,
}));

// Prioritize familiar Indonesian cash/banking flows without changing persisted enum values.
const ACCOUNT_CATEGORY_ORDER: ACCOUNT_CATEGORIES[] = [
  ACCOUNT_CATEGORIES.cash,
  ACCOUNT_CATEGORIES.digitalWallet,
  ACCOUNT_CATEGORIES.currentAccount,
  ACCOUNT_CATEGORIES.saving,
  ACCOUNT_CATEGORIES.creditCard,
  ACCOUNT_CATEGORIES.general,
  ACCOUNT_CATEGORIES.investment,
  ACCOUNT_CATEGORIES.crypto,
  ACCOUNT_CATEGORIES.bonus,
  ACCOUNT_CATEGORIES.insurance,
  ACCOUNT_CATEGORIES.overdraft,
];
const selectableAccountCategories = computed(() =>
  Object.entries(ACCOUNT_CATEGORIES_TRANSLATION_KEYS)
    .filter(([category]) => !isDedicatedFlowAccountCategory(category as ACCOUNT_CATEGORIES))
    .sort(([first], [second]) => {
      // New or upstream categories should follow the Indonesia-first shortlist,
      // not jump ahead just because indexOf() returned -1.
      const firstIndex = ACCOUNT_CATEGORY_ORDER.indexOf(first as ACCOUNT_CATEGORIES);
      const secondIndex = ACCOUNT_CATEGORY_ORDER.indexOf(second as ACCOUNT_CATEGORIES);
      const fallback = ACCOUNT_CATEGORY_ORDER.length;
      return (firstIndex < 0 ? fallback : firstIndex) - (secondIndex < 0 ? fallback : secondIndex);
    }),
);

const categoryOptions = computed(() =>
  selectableAccountCategories.value.map(([value, labelKey]) => ({
    value,
    label: t(labelKey),
    icon: getAccountTypeIcon({ category: value as ACCOUNT_CATEGORIES }),
    iconClass: getAccountTypeTintedChipClass({ category: value as ACCOUNT_CATEGORIES }),
  })),
);
const selectedPaymentMethod = computed<VerbosePaymentType | null>({
  get: () => VERBOSE_PAYMENT_TYPES.find((item) => item.value === form.defaultPaymentType?.value) ?? null,
  set: (value) => {
    form.defaultPaymentType =
      NULLABLE_PAYMENT_TYPE_OPTIONS.find((item) => item.value === value?.value) ?? NO_PAYMENT_TYPE_OPTION;
  },
});

const createAccountMutation = useMutation({ mutationFn: createAccount });
const isSubmitting = computed(() => createAccountMutation.isPending.value);
const canSubmit = computed(
  () =>
    !isSubmitting.value &&
    !!form.name.trim() &&
    !!defaultCurrency.value &&
    Number.isFinite(form.initialBalance ?? 0) &&
    Number.isFinite(form.creditLimit ?? 0) &&
    (form.creditLimit ?? 0) >= 0,
);
defineExpose({ isSubmitting, canSubmit });

const submit = async () => {
  if (!canSubmit.value || !isFormValid()) return;

  try {
    await createAccountMutation.mutateAsync({
      currencyCode: defaultCurrency.value,
      name: form.name.trim(),
      accountCategory: form.accountCategory,
      defaultPaymentType: form.defaultPaymentType?.value ?? null,
      creditLimit: form.creditLimit ?? 0,
      initialBalance: form.initialBalance ?? 0,
      ...toOptionalLogoPayload({ selection: form.logo }),
    });

    trackAnalyticsEvent({
      event: 'account_created',
      properties: {
        currency: defaultCurrency.value,
      },
    });

    addNotification({
      text: t('forms.createAccount.notifications.success'),
      type: NotificationType.success,
    });

    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey as string[];
        return queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.transactionChange);
      },
    });

    useOnboardingStore().completeTask('create-account');

    emit('created');
  } catch (error) {
    addNotification({
      text: error instanceof Error ? error.message : t('forms.createAccount.notifications.error'),
      type: NotificationType.error,
    });
  }
};
</script>

<template>
  <form :id="props.formId" class="@container/create-account grid gap-4" @submit.prevent="submit">
    <InputField
      v-model="form.name"
      :label="$t('forms.createAccount.nameLabel')"
      :placeholder="$t('forms.createAccount.namePlaceholder')"
      :error-message="getFieldErrorMessage('form.name')"
      @blur="touchField('form.name')"
      required
    >
      <template #label-right><FormFieldHelp topic="accountName" /></template>
      <template #field-right>
        <LogoSquareField
          v-model="form.logo"
          :name-for-search="form.name"
          :reset-label="$t('common.logo.remove')"
          size-class="size-11 rounded-lg md:size-9"
        >
          <template #placeholder>
            <AccountLogo :account="logoPlaceholderAccount" class="size-11 rounded-lg md:size-9" />
          </template>
        </LogoSquareField>
      </template>
    </InputField>

    <FormattedAmountField
      v-model="form.initialBalance"
      :label="$t('forms.createAccount.initialBalanceLabel')"
      :placeholder="$t('forms.createAccount.initialBalancePlaceholder')"
      :aria-label="$t('forms.createAccount.initialBalanceLabel')"
      :currency-code="defaultCurrency"
    >
      <template #label-right>
        <FormFieldHelp topic="accountInitialBalance" />
      </template>
    </FormattedAmountField>

    <OptionPickerDialog
      :model-value="form.accountCategory"
      :options="categoryOptions"
      :label="$t('forms.createAccount.accountCategoryLabel')"
      :placeholder="$t('forms.createAccount.accountCategoryPlaceholder')"
      @update:model-value="(value) => (form.accountCategory = value as ACCOUNT_CATEGORIES)"
    >
      <template #label-right><FormFieldHelp topic="accountCategory" /></template>
    </OptionPickerDialog>
    <p
      v-if="form.accountCategory === ACCOUNT_CATEGORIES.digitalWallet"
      class="text-muted-foreground -mt-2 text-xs leading-relaxed"
    >
      {{ $t('forms.createAccount.digitalWalletHint') }}
    </p>

    <PaymentMethodDialog v-model="selectedPaymentMethod" :label="$t('forms.createAccount.defaultPaymentTypeLabel')">
      <template #label-right><FormFieldHelp topic="accountPaymentType" /></template>
    </PaymentMethodDialog>

    <FormattedAmountField
      v-model="form.creditLimit"
      :label="$t('forms.createAccount.creditLimitLabel')"
      :placeholder="$t('forms.createAccount.creditLimitPlaceholder')"
      :aria-label="$t('forms.createAccount.creditLimitLabel')"
      :currency-code="defaultCurrency"
    >
      <template #label-right>
        <FormFieldHelp topic="accountCreditLimit" />
      </template>
    </FormattedAmountField>

    <!-- Keep the form reusable standalone; the dialog renders its action in a non-scrolling footer. -->
    <div v-if="props.showSubmitButton" class="flex">
      <ui-button type="submit" class="ml-auto min-w-30" :disabled="!canSubmit">
        {{
          createAccountMutation.isPending.value
            ? $t('forms.createAccount.submitButtonLoading')
            : $t('forms.createAccount.submitButton')
        }}
      </ui-button>
    </div>
  </form>
</template>
