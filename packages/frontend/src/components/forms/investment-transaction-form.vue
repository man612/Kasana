<script setup lang="ts">
import { loadExchangeRatesForDate } from '@/api/currencies';
import { beiLotsToShares } from '@/common/utils/investment-units';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { type SettlementMode, calculateSettlementPreview } from '@/common/utils/settlement-preview';
import DateField from '@/components/fields/date-field.vue';
import FormattedAmountField from '@/components/fields/formatted-amount-field.vue';
import InputField from '@/components/fields/input-field.vue';
import SelectField from '@/components/fields/select-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import { Checkbox } from '@/components/lib/ui/checkbox';
import { type PillTabItem, PillTabs } from '@/components/lib/ui/pill-tabs';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useCreateInvestmentTransaction } from '@/composable/data-queries/investment-transactions';
import { useFormValidation } from '@/composable/form-validator';
import { useCurrencyName, useFormatCurrency } from '@/composable/formatters';
import { useLinkedCurrencyGroup } from '@/composable/use-linked-currency-group';
import { useCurrenciesStore } from '@/stores/currencies';
import { INVESTMENT_TRANSACTION_CATEGORY, type CurrencyModel } from '@bt/shared/types';
import { useQuery } from '@tanstack/vue-query';
import { minValue, required, requiredIf } from '@vuelidate/validators';
import { format } from 'date-fns';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface SecurityOption {
  value: string;
  label: string;
  /** Trading currency of the security; drives the settlement-currency defaults. */
  currencyCode?: string;
  isBeiStock?: boolean;
}

const props = defineProps<{
  formId?: string;
  portfolioId: string;
  securities: SecurityOption[];
  securityId?: string | null;
}>();

const emit = defineEmits(['success']);

const { addNotification } = useNotificationCenter();
const createTransactionMutation = useCreateInvestmentTransaction();

const transactionTypeMap: Partial<Record<INVESTMENT_TRANSACTION_CATEGORY, string>> = {
  [INVESTMENT_TRANSACTION_CATEGORY.buy]: 'forms.investmentTransaction.types.buy',
  [INVESTMENT_TRANSACTION_CATEGORY.sell]: 'forms.investmentTransaction.types.sell',
  [INVESTMENT_TRANSACTION_CATEGORY.dividend]: 'forms.investmentTransaction.types.dividend',
  [INVESTMENT_TRANSACTION_CATEGORY.fee]: 'forms.investmentTransaction.types.fee',
  [INVESTMENT_TRANSACTION_CATEGORY.tax]: 'forms.investmentTransaction.types.tax',
};

const transactionTypes = computed(() =>
  (Object.keys(transactionTypeMap) as INVESTMENT_TRANSACTION_CATEGORY[]).map((type) => ({
    value: type,
    label: t(transactionTypeMap[type]!),
  })),
);

const form = reactive({
  type: transactionTypes.value[0]!,
  security: null as SecurityOption | null,
  quantity: '',
  price: '',
  date: new Date(),
  fees: '',
  note: '',
  settlementCurrency: null as CurrencyModel | null,
  settlementAmount: '',
  settlementFees: '',
  settlementRate: '',
});

const quantityUnit = ref('shares');
const showLotPicker = computed(
  () =>
    form.security?.isBeiStock &&
    (form.type.value === INVESTMENT_TRANSACTION_CATEGORY.buy ||
      form.type.value === INVESTMENT_TRANSACTION_CATEGORY.sell),
);
const quantityInLots = computed(() => showLotPicker.value && quantityUnit.value === 'lots');
const transactionQuantity = computed(() =>
  quantityInLots.value ? beiLotsToShares(String(form.quantity)) : form.quantity,
);
const hasInvalidLots = computed(() => quantityInLots.value && !!form.quantity && transactionQuantity.value === null);
const quantityUnits = computed<PillTabItem[]>(() => [
  { value: 'shares', label: t('forms.investmentTransaction.quantityShares') },
  { value: 'lots', label: t('forms.investmentTransaction.quantityLots') },
]);

watch(
  [() => form.security?.value, showLotPicker],
  () => {
    if (quantityUnit.value === 'lots') form.quantity = '';
    quantityUnit.value = 'shares';
  },
  { flush: 'sync' },
);

const useSettlement = ref(false);
const settlementMode = ref<SettlementMode>('fee');

const currenciesStore = useCurrenciesStore();
const { formatCurrencyLabel } = useCurrencyName();
const { formatAmountByCurrencyCode } = useFormatCurrency();
const linkedCurrencyGroup = useLinkedCurrencyGroup();

const securityCurrencyCode = computed(() => form.security?.currencyCode ?? null);

const priceAmount = computed<number | null>({
  get: () => (form.price === '' ? null : Number(form.price)),
  set: (value) => {
    form.price = value === null ? '' : String(value);
  },
});
const feeAmount = computed<number | null>({
  get: () => (form.fees === '' ? null : Number(form.fees)),
  set: (value) => {
    form.fees = value === null ? '' : String(value);
  },
});

const basicCashAmount = computed(() => {
  if (!transactionQuantity.value || form.price === '' || useSettlement.value) return null;
  const gross = Number(transactionQuantity.value) * Number(form.price);
  const fees = Number(form.fees);
  if (!Number.isFinite(gross) || !Number.isFinite(fees)) return null;
  if (form.type.value === INVESTMENT_TRANSACTION_CATEGORY.buy) return -(gross + fees);
  if (form.type.value === INVESTMENT_TRANSACTION_CATEGORY.sell) return gross - fees;
  return null;
});

const isCrossCurrency = computed(
  () =>
    useSettlement.value &&
    !!form.settlementCurrency &&
    !!securityCurrencyCode.value &&
    form.settlementCurrency.code !== securityCurrencyCode.value,
);

const isCashReceived = computed(() =>
  (
    [
      INVESTMENT_TRANSACTION_CATEGORY.sell,
      INVESTMENT_TRANSACTION_CATEGORY.dividend,
    ] as INVESTMENT_TRANSACTION_CATEGORY[]
  ).includes(form.type.value as INVESTMENT_TRANSACTION_CATEGORY),
);

const settlementModeItems = computed<PillTabItem[]>(() => [
  { value: 'fee', label: t('forms.investmentTransaction.settlement.modeFee') },
  { value: 'auto', label: t('forms.investmentTransaction.settlement.modeAuto') },
  { value: 'rate', label: t('forms.investmentTransaction.settlement.modeRate') },
]);

// Default the settlement currency to the security's currency once the toggle
// is on. Stays in sync until the user picks something else.
watch([useSettlement, securityCurrencyCode], ([enabled, currencyCode]) => {
  if (enabled && !form.settlementCurrency && currencyCode) {
    form.settlementCurrency = currenciesStore.systemCurrencies.find((c) => c.code === currencyCode) ?? null;
  }
});

watch(
  () => [props.securityId, props.securities],
  ([securityId, securities]) => {
    if (securityId && Array.isArray(securities) && securities.length) {
      form.security = (securities as SecurityOption[]).find((s) => s.value === securityId) || null;
    }
  },
  { immediate: true },
);

// Drives the "Auto" mode preview only. The backend re-fetches authoritatively.
const transactionDateStr = computed(() => format(form.date, 'yyyy-MM-dd'));
const marketRatesEnabled = computed(() => isCrossCurrency.value && settlementMode.value === 'auto');
const marketRatesQuery = useQuery({
  queryKey: computed(() => [...VUE_QUERY_CACHE_KEYS.exchangeRatesForDate, transactionDateStr.value]),
  queryFn: () => loadExchangeRatesForDate(transactionDateStr.value),
  enabled: marketRatesEnabled,
  // Historical market rates for a fixed date never change
  staleTime: Infinity,
});

// Stored rates are USD-pivoted (1 USD = N units), so the security→settlement
// cross-rate is the ratio of the two USD legs.
const RATES_PIVOT_CURRENCY = 'USD';
const marketRate = computed<number | null>(() => {
  if (!isCrossCurrency.value || !securityCurrencyCode.value || !form.settlementCurrency) return null;
  const rates = marketRatesQuery.data.value;
  if (!rates) return null;

  const findUsdRate = (code: string): number | null => {
    if (code === RATES_PIVOT_CURRENCY) return 1;
    return rates.find((r) => r.baseCode === RATES_PIVOT_CURRENCY && r.quoteCode === code)?.rate ?? null;
  };

  const usdToSecurity = findUsdRate(securityCurrencyCode.value);
  const usdToSettlement = findUsdRate(form.settlementCurrency.code);
  if (!usdToSecurity || !usdToSettlement) return null;

  return usdToSettlement / usdToSecurity;
});

const settlementPreview = computed(() => {
  if (!isCrossCurrency.value) return null;
  return calculateSettlementPreview({
    isCashIn: isCashReceived.value,
    quantity: transactionQuantity.value ?? '',
    price: form.price,
    totalCash: form.settlementAmount,
    mode: settlementMode.value,
    fee: form.settlementFees,
    rate: settlementMode.value === 'auto' ? (marketRate.value ?? undefined) : form.settlementRate,
  });
});

const isPreviewLoading = computed(() => settlementMode.value === 'auto' && marketRatesQuery.isLoading.value);
const isMarketRateErrored = computed(
  () => settlementMode.value === 'auto' && marketRatesEnabled.value && marketRatesQuery.isError.value,
);
const isMarketRateMissing = computed(
  () =>
    settlementMode.value === 'auto' &&
    marketRatesEnabled.value &&
    !marketRatesQuery.isLoading.value &&
    !marketRatesQuery.isError.value &&
    marketRate.value === null,
);

const previewData = computed(() => {
  const preview = settlementPreview.value;
  if (!preview || !form.settlementCurrency) return null;
  return {
    rateOnly: settlementMode.value === 'fee',
    fee: preview.fee,
    feeStr: preview.fee.toFixed(2),
    rate: preview.rate.toFixed(4),
    currency: form.settlementCurrency.code,
  };
});

const validationRules = computed(() => ({
  security: { required },
  quantity: { required, minValue: minValue(Number.MIN_VALUE) },
  price: { required, minValue: minValue(0) },
  date: { required },
  settlementCurrency: { required: requiredIf(() => useSettlement.value) },
  settlementAmount: { required: requiredIf(() => useSettlement.value), minValue: minValue(0) },
  settlementRate: {
    required: requiredIf(() => isCrossCurrency.value && settlementMode.value === 'rate'),
    minValue: minValue(Number.MIN_VALUE),
  },
}));

const { isFormValid, getFieldErrorMessage, touchField, resetValidation } = useFormValidation(
  { form },
  computed(() => ({ form: validationRules.value })),
);

const resetForm = () => {
  form.type = { value: INVESTMENT_TRANSACTION_CATEGORY.buy, label: t('forms.investmentTransaction.types.buy') };
  form.security = null;
  form.quantity = '';
  form.price = '';
  form.date = new Date();
  form.fees = '';
  form.note = '';
  form.settlementCurrency = null;
  form.settlementAmount = '';
  form.settlementFees = '';
  form.settlementRate = '';
  useSettlement.value = false;
  settlementMode.value = 'fee';
  resetValidation();
};

const onSubmit = async () => {
  touchField('form.security');
  touchField('form.quantity');
  touchField('form.price');
  touchField('form.date');
  touchField('form.settlementCurrency');
  touchField('form.settlementAmount');
  touchField('form.settlementRate');

  if (!isFormValid()) {
    return;
  }

  if (!form.security || !transactionQuantity.value || isSubmitDisabled.value) return;

  try {
    const trimmedNote = form.note.trim();
    const settlementEnabled = useSettlement.value && form.settlementCurrency;

    // 'auto' sends neither field — the service then falls back to the market
    // rate and derives the fee. 'fee' / 'rate' send exactly one each.
    const crossCurrencyModePayload =
      settlementMode.value === 'fee'
        ? { settlementFees: form.settlementFees || '0' }
        : settlementMode.value === 'rate'
          ? { settlementRate: form.settlementRate }
          : {};

    await createTransactionMutation.mutateAsync({
      portfolioId: props.portfolioId,
      category: form.type.value,
      securityId: form.security.value,
      quantity: transactionQuantity.value,
      price: form.price,
      date: form.date.toISOString(),
      fees: settlementEnabled ? '0' : form.fees || '0',
      ...(trimmedNote ? { name: trimmedNote } : {}),
      ...(settlementEnabled
        ? {
            settlementCurrencyCode: form.settlementCurrency!.code,
            settlementAmount: form.settlementAmount,
            ...(isCrossCurrency.value ? crossCurrencyModePayload : {}),
          }
        : {}),
    });

    addNotification({
      text: t('forms.investmentTransaction.notifications.success'),
      type: NotificationType.success,
    });

    resetForm();
    emit('success');
  } catch (error) {
    addNotification({
      text: error instanceof Error ? error.message : t('forms.investmentTransaction.notifications.error'),
      type: NotificationType.error,
    });
  }
};
const isSubmitDisabled = computed(
  () =>
    createTransactionMutation.isPending.value ||
    !form.security ||
    !transactionQuantity.value ||
    Number(transactionQuantity.value) <= 0 ||
    form.price === '' ||
    Number(form.price) < 0 ||
    Number(form.fees) < 0 ||
    (form.type.value === INVESTMENT_TRANSACTION_CATEGORY.sell &&
      basicCashAmount.value != null &&
      basicCashAmount.value < 0) ||
    (useSettlement.value && (!form.settlementCurrency || form.settlementAmount === '')),
);
defineExpose({ isSubmitDisabled, isSubmitting: createTransactionMutation.isPending });
</script>

<template>
  <form :id="formId" class="@container grid gap-5" @submit.prevent="onSubmit">
    <div class="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <SelectField
        v-model="form.type"
        :label="$t('forms.investmentTransaction.typeLabel')"
        :values="transactionTypes"
        value-key="value"
        label-key="label"
        :disabled="createTransactionMutation.isPending.value"
      />

      <SelectField
        v-if="!securityId"
        v-model="form.security"
        :label="$t('forms.investmentTransaction.securityLabel')"
        :values="securities"
        value-key="value"
        label-key="label"
        :placeholder="$t('forms.investmentTransaction.securityPlaceholder')"
        :disabled="createTransactionMutation.isPending.value"
        :error-message="getFieldErrorMessage('form.security')"
        @blur="touchField('form.security')"
      />

      <PillTabs
        full-width
        v-if="showLotPicker"
        v-model="quantityUnit"
        :items="quantityUnits"
        :aria-label="$t('forms.investmentTransaction.quantityLabel')"
        @update:model-value="form.quantity = ''"
      />
      <InputField
        v-model="form.quantity"
        :label="
          $t(
            quantityInLots
              ? 'forms.investmentTransaction.quantityLots'
              : showLotPicker
                ? 'forms.investmentTransaction.quantityShares'
                : 'forms.investmentTransaction.quantityLabel',
          )
        "
        type="number"
        step="any"
        :placeholder="$t('forms.investmentTransaction.quantityPlaceholder')"
        :disabled="createTransactionMutation.isPending.value"
        :error-message="
          hasInvalidLots ? $t('forms.investmentTransaction.invalidLots') : getFieldErrorMessage('form.quantity')
        "
        @blur="touchField('form.quantity')"
      />

      <p v-if="showLotPicker" class="text-muted-foreground -mt-3 text-xs">
        {{ $t('forms.investmentTransaction.beiLotHelp') }}
      </p>

      <div>
        <FormattedAmountField
          v-if="securityCurrencyCode === 'IDR'"
          v-model="priceAmount"
          currency-code="IDR"
          :maximum-fraction-digits="10"
          :label="
            $t(showLotPicker ? 'forms.investmentTransaction.pricePerShare' : 'forms.investmentTransaction.priceLabel')
          "
          :disabled="createTransactionMutation.isPending.value"
          :error-message="getFieldErrorMessage('form.price')"
          @blur="touchField('form.price')"
        />
        <InputField
          v-else
          v-model="form.price"
          :label="
            securityCurrencyCode
              ? `${$t('forms.investmentTransaction.priceLabel')} (${securityCurrencyCode})`
              : $t('forms.investmentTransaction.priceLabel')
          "
          type="number"
          step="any"
          :placeholder="$t('forms.investmentTransaction.pricePlaceholder')"
          :disabled="createTransactionMutation.isPending.value"
          :error-message="getFieldErrorMessage('form.price')"
          @blur="touchField('form.price')"
        />
        <p class="text-muted-foreground mt-1.5 text-xs">{{ $t('forms.investmentTransaction.priceHelp') }}</p>
      </div>

      <FormattedAmountField
        v-if="!useSettlement && securityCurrencyCode === 'IDR'"
        v-model="feeAmount"
        currency-code="IDR"
        :maximum-fraction-digits="10"
        :label="$t('forms.investmentTransaction.feesLabel')"
        :disabled="createTransactionMutation.isPending.value"
      />
      <InputField
        v-else-if="!useSettlement"
        v-model="form.fees"
        :label="$t('forms.investmentTransaction.feesLabel')"
        type="number"
        step="any"
        :placeholder="$t('forms.investmentTransaction.feesPlaceholder')"
        :disabled="createTransactionMutation.isPending.value"
      />

      <DateField
        v-model="form.date"
        :label="$t('forms.investmentTransaction.dateLabel')"
        :disabled="createTransactionMutation.isPending.value"
        :error-message="getFieldErrorMessage('form.date')"
        @blur="touchField('form.date')"
      />
    </div>

    <p
      v-if="securityCurrencyCode && basicCashAmount != null"
      class="border-border flex justify-between gap-2 border-t pt-2 text-sm"
    >
      <span class="text-muted-foreground">{{ $t('forms.investmentTransaction.estimatedCash') }}</span>
      <strong class="text-right tabular-nums">{{
        formatAmountByCurrencyCode(basicCashAmount, securityCurrencyCode)
      }}</strong>
    </p>

    <details
      :open="securityCurrencyCode !== 'IDR' || useSettlement"
      class="border-border overflow-hidden rounded-md border"
    >
      <summary v-if="securityCurrencyCode === 'IDR'" class="cursor-pointer px-3 py-2 text-sm">
        {{ $t('forms.investmentTransaction.settlement.advanced') }}
      </summary>
      <summary v-else class="sr-only">{{ $t('forms.investmentTransaction.settlement.advanced') }}</summary>
      <label class="hover:bg-muted/50 flex cursor-pointer items-center gap-3 p-4 transition-colors">
        <Checkbox
          v-model="useSettlement"
          :disabled="createTransactionMutation.isPending.value"
          data-test="settlement-toggle"
        />
        <span class="grid gap-0.5">
          <span class="text-sm font-medium">{{ $t('forms.investmentTransaction.settlement.toggleLabel') }}</span>
          <span class="text-muted-foreground text-xs">
            {{ $t('forms.investmentTransaction.settlement.toggleHint') }}
          </span>
        </span>
      </label>

      <Transition name="kasana-feedback">
        <div v-if="useSettlement" class="grid gap-4 px-4 pb-4">
          <div class="grid grid-cols-1 gap-4 @md:grid-cols-2">
            <SelectField
              v-model="form.settlementCurrency"
              :label="$t('forms.investmentTransaction.settlement.currencyLabel')"
              :values="currenciesStore.systemCurrencies"
              :pinned-group="linkedCurrencyGroup"
              value-key="code"
              :label-key="
                (item: CurrencyModel) => formatCurrencyLabel({ code: item.code, fallbackName: item.currency })
              "
              with-search
              :placeholder="$t('forms.investmentTransaction.settlement.currencyPlaceholder')"
              :disabled="createTransactionMutation.isPending.value"
              :error-message="getFieldErrorMessage('form.settlementCurrency')"
              @blur="touchField('form.settlementCurrency')"
            />

            <div>
              <InputField
                v-model="form.settlementAmount"
                :label="
                  isCashReceived
                    ? $t('forms.investmentTransaction.settlement.totalReceivedLabel')
                    : $t('forms.investmentTransaction.settlement.totalPaidLabel')
                "
                type="number"
                step="any"
                :placeholder="$t('forms.investmentTransaction.settlement.totalPlaceholder')"
                :disabled="createTransactionMutation.isPending.value"
                :error-message="getFieldErrorMessage('form.settlementAmount')"
                @blur="touchField('form.settlementAmount')"
              />
              <p v-if="!isCrossCurrency" class="text-muted-foreground mt-1.5 text-xs">
                {{ $t('forms.investmentTransaction.settlement.sameCurrencyFeeHint') }}
              </p>
            </div>
          </div>

          <template v-if="isCrossCurrency">
            <PillTabs
              v-model="settlementMode"
              :items="settlementModeItems"
              :disabled="createTransactionMutation.isPending.value"
            />

            <div class="grid grid-cols-1 items-start gap-4 @md:grid-cols-2">
              <div v-if="settlementMode === 'fee'">
                <InputField
                  v-model="form.settlementFees"
                  :label="$t('forms.investmentTransaction.settlement.feeLabel')"
                  type="number"
                  step="any"
                  :placeholder="$t('forms.investmentTransaction.settlement.feePlaceholder')"
                  :disabled="createTransactionMutation.isPending.value"
                />
                <p class="text-muted-foreground mt-1.5 text-xs">
                  {{ $t('forms.investmentTransaction.settlement.crossCurrencyFeeHint') }}
                </p>
              </div>

              <div v-else-if="settlementMode === 'rate'">
                <InputField
                  v-model="form.settlementRate"
                  :label="$t('forms.investmentTransaction.settlement.rateLabel')"
                  type="number"
                  step="any"
                  :placeholder="$t('forms.investmentTransaction.settlement.ratePlaceholder')"
                  :disabled="createTransactionMutation.isPending.value"
                  :error-message="getFieldErrorMessage('form.settlementRate')"
                  @blur="touchField('form.settlementRate')"
                />
                <p class="text-muted-foreground mt-1.5 text-xs">
                  {{ $t('forms.investmentTransaction.settlement.rateHint') }}
                </p>
              </div>

              <p v-else class="text-muted-foreground text-xs">
                {{ $t('forms.investmentTransaction.settlement.autoHint') }}
              </p>

              <div
                class="bg-muted/40 grid min-h-14 items-center rounded-md px-3 py-2 text-xs"
                data-test="settlement-preview-box"
              >
                <div
                  v-if="isPreviewLoading"
                  class="bg-muted h-4 w-40 animate-pulse rounded"
                  data-test="preview-skeleton"
                />
                <p v-else-if="isMarketRateErrored" class="text-destructive-text">
                  {{ $t('forms.investmentTransaction.settlement.previewFetchFailed') }}
                </p>
                <p v-else-if="isMarketRateMissing" class="text-destructive-text">
                  {{ $t('forms.investmentTransaction.settlement.previewUnavailable') }}
                </p>
                <template v-else-if="previewData">
                  <p v-if="previewData.rateOnly" class="font-medium" data-test="settlement-preview">
                    <i18n-t keypath="forms.investmentTransaction.settlement.previewRate" tag="span">
                      <template #rate>
                        <span class="text-foreground font-mono">{{ previewData.rate }}</span>
                      </template>
                    </i18n-t>
                  </p>
                  <p v-else class="font-medium" data-test="settlement-preview">
                    <i18n-t keypath="forms.investmentTransaction.settlement.previewFee" tag="span">
                      <template #fee>
                        <span
                          :class="['font-mono', previewData.fee > 0 ? 'text-app-expense-color' : 'text-foreground']"
                        >
                          {{ previewData.feeStr }}
                        </span>
                      </template>
                      <template #currency>{{ previewData.currency }}</template>
                      <template #rate>
                        <span class="text-foreground font-mono">{{ previewData.rate }}</span>
                      </template>
                    </i18n-t>
                  </p>
                </template>
                <p v-else class="text-muted-foreground/70">
                  {{ $t('forms.investmentTransaction.settlement.previewPlaceholder') }}
                </p>
              </div>
            </div>
          </template>
        </div>
      </Transition>
    </details>

    <TextareaField
      v-model="form.note"
      :label="$t('forms.investmentTransaction.noteLabel')"
      :placeholder="$t('forms.investmentTransaction.notePlaceholder')"
      :disabled="createTransactionMutation.isPending.value"
      :maxlength="2000"
      :rows="1"
      :max-rows="3"
    />
  </form>
</template>
