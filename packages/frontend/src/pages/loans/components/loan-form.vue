<script setup lang="ts">
import { type CreateLoanPayload, type LoanApi, type UpdateLoanPayload } from '@/api/loans';
import FormFieldHelp from '@/components/common/form-field-help.vue';
import DateField from '@/components/fields/date-field.vue';
import InputField from '@/components/fields/input-field.vue';
import OptionPickerDialog from '@/components/fields/option-picker-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { useFormatCurrency } from '@/composable';
import { useFormValidation } from '@/composable/form-validator';
import { LOAN_TYPE, SUPPORTED_LOAN_TYPES } from '@bt/shared/types';
import { between, helpers, integer, maxLength, required } from '@vuelidate/validators';
import { differenceInCalendarMonths, format, isValid, parseISO } from 'date-fns';
import { InfoIcon } from '@lucide/vue';
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import FormattedAmountField from '@/components/fields/formatted-amount-field.vue';
import TermMonthsField from './term-months-field.vue';
import { getLoanTypeIcon, getLoanTypeTintedChipClass } from '../loan-type-presentation';

const MIN_INTEREST_RATE = 0;
// Backend caps at 99.9999; mirrored so server validation only fires for malicious requests.
const MAX_INTEREST_RATE = 99.9999;
const MIN_TERM_MONTHS = 1;
const MAX_TERM_MONTHS = 1200;

const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit';
    initialLoan?: LoanApi | null;
    submitting?: boolean;
    /** Required when the submit button lives outside the <form> (e.g. in a dialog footer slot). */
    formId?: string;
  }>(),
  { mode: 'create', initialLoan: null, submitting: false, formId: undefined },
);

const emit = defineEmits<{
  submit: [payload: CreateLoanPayload | UpdateLoanPayload];
}>();

const isEdit = computed(() => props.mode === 'edit');

const { t } = useI18n();
const { formatAmountByCurrencyCode } = useFormatCurrency();
const formatLoanMoney = (value: number) =>
  form.currencyCode === 'IDR'
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
    : formatAmountByCurrencyCode(value, form.currencyCode);

interface FormState {
  name: string;
  currencyCode: string;
  /** Create: initialBalance (outstanding at creation). Edit: currentBalance. Always a positive decimal – service flips the sign. */
  balance: number | null;
  /** 'yyyy-MM-dd' date the balance correction is "as of". Edit mode only; defaults to today. */
  balanceAsOf: string;
  loanType: LOAN_TYPE;
  originalPrincipal: number | null;
  interestRate: number | null;
  termMonths: number | null;
  startDate: Date;
  minPayment: number | null;
  plannedPayment: number | null;
  paymentDayOfMonth: number | null;
  lenderName: string;
  accountNumber: string;
}

const buildInitialState = (): FormState => {
  if (props.initialLoan) {
    const loan = props.initialLoan;
    return {
      name: loan.name,
      currencyCode: loan.currencyCode,
      balance: Math.abs(loan.currentBalance),
      balanceAsOf: format(new Date(), 'yyyy-MM-dd'),
      loanType: loan.loanDetails.loanType,
      originalPrincipal: loan.loanDetails.originalPrincipal,
      interestRate: loan.loanDetails.interestRate,
      termMonths: loan.loanDetails.termMonths,
      startDate: parseISO(loan.loanDetails.startDate),
      minPayment: loan.loanDetails.minPayment,
      plannedPayment: loan.loanDetails.plannedPayment,
      paymentDayOfMonth: loan.loanDetails.paymentDayOfMonth,
      lenderName: loan.loanDetails.lenderName ?? '',
      accountNumber: loan.loanDetails.accountNumber ?? '',
    };
  }
  return {
    name: '',
    currencyCode: 'IDR',
    balance: null,
    balanceAsOf: format(new Date(), 'yyyy-MM-dd'),
    loanType: LOAN_TYPE.personal,
    originalPrincipal: null,
    interestRate: null,
    termMonths: null,
    startDate: new Date(),
    minPayment: null,
    plannedPayment: null,
    paymentDayOfMonth: null,
    lenderName: '',
    accountNumber: '',
  };
};

const form = reactive<FormState>(buildInitialState());

const loanTypeOptions = computed(() =>
  SUPPORTED_LOAN_TYPES.map((value) => ({
    label: t(`loans.types.${value}`),
    value,
    icon: getLoanTypeIcon({ loanType: value }),
    iconClass: getLoanTypeTintedChipClass({ loanType: value }),
  })),
);

// Amortization over what's left: M = B·r·(1+r)^m / ((1+r)^m − 1), where B is the outstanding
// balance and m the months remaining in the term. Interest accrues on the current balance, so for
// an off-schedule loan (extra payments, missed payments, mid-life creation) this yields the payment
// that actually reaches zero by the end of the term — the abolished alternative, original principal
// over the full term, quotes the contractual payment but not "what do I need from here".
// Zero-interest degenerates to B/m. Returns null on missing/non-positive input so the caller can
// hide the hint. On an on-schedule loan both bases produce the same number.
const estimatedMinPayment = computed<number | null>(() => {
  const balance = form.balance ?? form.originalPrincipal;
  const annualRate = form.interestRate;
  const months = form.termMonths;
  if (!balance || balance <= 0) return null;
  if (annualRate == null || annualRate < 0) return null;
  if (!months || months <= 0) return null;

  const elapsedMonths = Math.max(differenceInCalendarMonths(new Date(), form.startDate), 0);
  const remainingMonths = Math.max(months - elapsedMonths, 1);

  if (annualRate === 0) return balance / remainingMonths;

  const r = annualRate / 12 / 100;
  const compound = Math.pow(1 + r, remainingMonths);
  const payment = (balance * r * compound) / (compound - 1);
  if (!Number.isFinite(payment) || payment <= 0) return null;
  return payment;
});

const estimatedMinPaymentLabel = computed(() => {
  if (estimatedMinPayment.value === null) return null;
  return formatLoanMoney(estimatedMinPayment.value);
});

const applyEstimatedMinPayment = () => {
  if (estimatedMinPayment.value === null) return;
  // Round to 2 decimals – field is for user-quoted amounts, not the raw long-division result.
  form.minPayment = Math.round(estimatedMinPayment.value * 100) / 100;
};

// Balance above principal is legitimate (negative amortization, capitalized interest) — soft heads-up,
// not a validation error. On edit the principal isn't editable, so compare against the stored value.
const referencePrincipal = computed<number | null>(() =>
  isEdit.value ? (props.initialLoan?.loanDetails.originalPrincipal ?? null) : form.originalPrincipal,
);
const balanceExceedsPrincipal = computed(
  () =>
    referencePrincipal.value !== null &&
    form.balance !== null &&
    Number(form.balance) > Number(referencePrincipal.value),
);

// Show the "as of" picker only when the balance actually changed – the server skips the
// correction event entirely for unchanged values, so the field is irrelevant otherwise.
const isBalanceChanged = computed(
  () =>
    isEdit.value && props.initialLoan !== null && Math.abs(props.initialLoan.currentBalance) !== Number(form.balance),
);

// Bridges DateField's Date object and form.balanceAsOf's yyyy-MM-dd string without a separate Date field.
const balanceAsOfDate = computed({
  get: () => parseISO(form.balanceAsOf),
  set: (date: Date) => {
    form.balanceAsOf = format(date, 'yyyy-MM-dd');
  },
});

const positiveMoney = helpers.withMessage(
  () => t('forms.loan.errors.mustBePositive'),
  (v: unknown) => v !== null && v !== undefined && Number(v) > 0,
);

const nonNegativeMoney = helpers.withMessage(
  () => t('forms.loan.errors.mustBeNonNegative'),
  (v: unknown) => v === null || v === undefined || Number(v) >= 0,
);

// Validated against the browser's local date for instant, timezone-correct feedback; the backend
// re-checks with a one-day grace as a clock-skew backstop.
const notInFuture = helpers.withMessage(
  () => t('forms.loan.errors.asOfInFuture'),
  (v: unknown) => typeof v !== 'string' || v <= format(new Date(), 'yyyy-MM-dd'),
);

const startDateNotInFuture = helpers.withMessage(
  () => t('forms.loan.errors.startDateInFuture'),
  (v: unknown) => !(v instanceof Date) || !isValid(v) || format(v, 'yyyy-MM-dd') <= format(new Date(), 'yyyy-MM-dd'),
);

const validationRules = {
  name: { required: helpers.withMessage(() => t('forms.loan.errors.required'), required), maxLength: maxLength(200) },
  currencyCode: { required: helpers.withMessage(() => t('forms.loan.errors.required'), required) },
  balance: {
    required: helpers.withMessage(() => t('forms.loan.errors.required'), required),
    nonNegative: nonNegativeMoney,
  },
  balanceAsOf: { notInFuture },
  startDate: { notInFuture: startDateNotInFuture },
  originalPrincipal: {
    required: helpers.withMessage(() => t('forms.loan.errors.required'), required),
    positive: positiveMoney,
  },
  interestRate: {
    required: helpers.withMessage(() => t('forms.loan.errors.required'), required),
    between: helpers.withMessage(
      () => t('forms.loan.errors.interestRateRange'),
      between(MIN_INTEREST_RATE, MAX_INTEREST_RATE),
    ),
  },
  termMonths: {
    integer,
    between: helpers.withMessage(
      () => t('forms.loan.errors.termRange'),
      (v: unknown) => v === null || v === undefined || (Number(v) >= MIN_TERM_MONTHS && Number(v) <= MAX_TERM_MONTHS),
    ),
  },
  minPayment: { nonNegative: nonNegativeMoney },
  plannedPayment: { nonNegative: nonNegativeMoney },
  paymentDayOfMonth: {
    integer,
    range: helpers.withMessage(
      () => t('forms.loan.errors.paymentDayRange'),
      (v: unknown) => v === null || v === undefined || (Number(v) >= 1 && Number(v) <= 31),
    ),
  },
  lenderName: { maxLength: maxLength(200) },
  accountNumber: { maxLength: maxLength(100) },
};

const { isFormValid, getFieldErrorMessage, touchField } = useFormValidation({ form }, { form: validationRules });

const submit = () => {
  if (props.submitting) return;
  if (!isFormValid()) return;

  const commonFields = {
    name: form.name.trim(),
    interestRate: Number(form.interestRate),
    termMonths: form.termMonths === null ? null : Number(form.termMonths),
    startDate: format(form.startDate, 'yyyy-MM-dd'),
    minPayment: form.minPayment === null ? null : Number(form.minPayment),
    plannedPayment: form.plannedPayment === null ? null : Number(form.plannedPayment),
    paymentDayOfMonth: form.paymentDayOfMonth === null ? null : Number(form.paymentDayOfMonth),
    lenderName: form.lenderName.trim() || null,
    accountNumber: form.accountNumber.trim() || null,
  };

  if (isEdit.value) {
    const payload: UpdateLoanPayload = { ...commonFields };
    // `currentBalance` triggers a manual balance correction (appends a timeline event server-side) –
    // only send it when actually changed. `currentBalanceAsOf` travels with it.
    const balance = Number(form.balance);
    if (!props.initialLoan || Math.abs(props.initialLoan.currentBalance) !== balance) {
      payload.currentBalance = balance;
      payload.currentBalanceAsOf = form.balanceAsOf;
    }
    emit('submit', payload);
    return;
  }

  const payload: CreateLoanPayload = {
    ...commonFields,
    currencyCode: form.currencyCode,
    initialBalance: Number(form.balance),
    loanType: form.loanType,
    originalPrincipal: Number(form.originalPrincipal),
  };

  emit('submit', payload);
};
</script>

<template>
  <form :id="formId" class="@container/loan-form grid gap-4" @submit.prevent="submit">
    <input type="hidden" name="currencyCode" :value="form.currencyCode" />
    <div
      class="grid grid-cols-1 items-start gap-3"
      :class="!isEdit && '@sm/loan-form:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'"
    >
      <InputField
        v-model="form.name"
        :label="$t('forms.loan.nameLabel')"
        :placeholder="$t('forms.loan.namePlaceholder')"
        :error-message="getFieldErrorMessage('form.name')"
        @blur="touchField('form.name')"
        non-label-wrapper
      >
        <template #label-right><FormFieldHelp topic="loanName" /></template>
      </InputField>

      <OptionPickerDialog
        v-if="!isEdit"
        :model-value="form.loanType"
        :options="loanTypeOptions"
        :label="$t('forms.loan.loanTypeLabel')"
        :placeholder="$t('forms.loan.loanTypePlaceholder')"
        @update:model-value="(value) => (form.loanType = value as LOAN_TYPE)"
      />
    </div>

    <div class="grid grid-cols-1 items-start gap-3 @sm/loan-form:grid-cols-2">
      <FormattedAmountField
        v-if="!isEdit"
        v-model="form.originalPrincipal"
        :currency-code="form.currencyCode"
        :label="$t('forms.loan.originalPrincipalLabel')"
        :placeholder="$t('forms.loan.originalPrincipalPlaceholder')"
        :error-message="getFieldErrorMessage('form.originalPrincipal')"
        @blur="touchField('form.originalPrincipal')"
      >
        <template #label-right><FormFieldHelp topic="loanPrincipal" /></template>
      </FormattedAmountField>
      <FormattedAmountField
        v-model="form.balance"
        :class="isEdit && '@sm/loan-form:col-span-2'"
        :currency-code="form.currencyCode"
        :label="isEdit ? $t('forms.loan.currentBalanceLabel') : $t('forms.loan.initialBalanceLabel')"
        :placeholder="$t('forms.loan.initialBalancePlaceholder')"
        :error-message="getFieldErrorMessage('form.balance')"
        @blur="touchField('form.balance')"
      >
        <template #label-right><FormFieldHelp topic="loanBalance" /></template>
      </FormattedAmountField>
      <p v-if="balanceExceedsPrincipal" class="text-warning-text -mt-2 text-xs @sm/loan-form:col-span-2">
        {{ $t('forms.loan.balanceExceedsPrincipalWarning') }}
      </p>
    </div>

    <DateField
      v-if="isBalanceChanged"
      v-model="balanceAsOfDate"
      :label="$t('forms.loan.balanceAsOfLabel')"
      :placeholder="$t('forms.loan.balanceAsOfPlaceholder')"
      :calendar-options="{ minDate: form.startDate, maxDate: new Date() }"
      :error-message="getFieldErrorMessage('form.balanceAsOf')"
    >
      <template #label-right><FormFieldHelp topic="loanBalanceDate" /></template>
    </DateField>

    <div class="grid grid-cols-1 items-start gap-3 @sm/loan-form:grid-cols-2">
      <InputField
        v-model="form.interestRate"
        type="number"
        :label="$t('forms.loan.interestRateLabel')"
        :placeholder="$t('forms.loan.interestRatePlaceholder')"
        :error-message="getFieldErrorMessage('form.interestRate')"
        @blur="touchField('form.interestRate')"
        non-label-wrapper
      >
        <template #label-right><FormFieldHelp topic="loanAPR" /></template>
      </InputField>
      <TermMonthsField
        v-model="form.termMonths"
        :label="$t('forms.loan.termMonthsLabel')"
        :placeholder="$t('forms.loan.termMonthsPlaceholder')"
        :error-message="getFieldErrorMessage('form.termMonths')"
        @blur="touchField('form.termMonths')"
      >
        <template #label-right><FormFieldHelp topic="loanTerm" /></template>
      </TermMonthsField>
    </div>

    <div class="grid grid-cols-1 items-start gap-3 @md/loan-form:grid-cols-[minmax(0,2fr)_minmax(0,0.75fr)]">
      <DateField
        v-model="form.startDate"
        :label="$t('forms.loan.startDateLabel')"
        :placeholder="$t('forms.loan.startDatePlaceholder')"
        :calendar-options="{ maxDate: new Date() }"
        :error-message="getFieldErrorMessage('form.startDate')"
      />
      <InputField
        v-model="form.paymentDayOfMonth"
        type="number"
        :label="$t('forms.loan.paymentDayLabel')"
        :placeholder="$t('forms.loan.paymentDayPlaceholder')"
        :error-message="getFieldErrorMessage('form.paymentDayOfMonth')"
        @blur="touchField('form.paymentDayOfMonth')"
        non-label-wrapper
      >
        <template #label-right><FormFieldHelp topic="loanPaymentDay" /></template>
      </InputField>
    </div>

    <div class="grid grid-cols-1 items-start gap-3 @sm/loan-form:grid-cols-2">
      <FormattedAmountField
        v-model="form.plannedPayment"
        :currency-code="form.currencyCode"
        :label="$t('forms.loan.plannedPaymentLabel')"
        :placeholder="$t('forms.loan.plannedPaymentPlaceholder')"
        :error-message="getFieldErrorMessage('form.plannedPayment')"
        @blur="touchField('form.plannedPayment')"
      >
        <template #label-right><FormFieldHelp topic="loanPlanned" /></template>
      </FormattedAmountField>
      <FormattedAmountField
        v-model="form.minPayment"
        :currency-code="form.currencyCode"
        :label="$t('forms.loan.minPaymentLabel')"
        :placeholder="$t('forms.loan.minPaymentPlaceholder')"
        :error-message="getFieldErrorMessage('form.minPayment')"
        @blur="touchField('form.minPayment')"
      >
        <template #label-right>
          <div class="flex items-center gap-1">
            <FormFieldHelp topic="loanMinimum" />
            <template v-if="estimatedMinPaymentLabel">
              <DesktopOnlyTooltip :content="$t('forms.loan.minPaymentEstimateTooltip')" side="top">
                <UiButton
                  type="button"
                  variant="link"
                  size="sm"
                  class="text-muted-foreground inline-flex h-auto max-w-full items-center gap-1 p-0 text-xs font-normal whitespace-nowrap no-underline"
                  :aria-label="$t('forms.loan.minPaymentApplyEstimateAriaLabel')"
                  @click="applyEstimatedMinPayment"
                >
                  <InfoIcon class="size-3 shrink-0" />
                  <span class="truncate hover:underline">{{ estimatedMinPaymentLabel }}</span>
                </UiButton>
              </DesktopOnlyTooltip>
            </template>
          </div>
        </template>
      </FormattedAmountField>
    </div>

    <div class="grid grid-cols-1 items-start gap-3 @sm/loan-form:grid-cols-2">
      <InputField
        v-model="form.lenderName"
        :label="$t('forms.loan.lenderNameLabel')"
        :placeholder="$t('forms.loan.lenderNamePlaceholder')"
        :error-message="getFieldErrorMessage('form.lenderName')"
        @blur="touchField('form.lenderName')"
        non-label-wrapper
      >
        <template #label-right><FormFieldHelp topic="loanLender" /></template>
      </InputField>
      <InputField
        v-model="form.accountNumber"
        :label="$t('forms.loan.accountNumberLabel')"
        :placeholder="$t('forms.loan.accountNumberPlaceholder')"
        :error-message="getFieldErrorMessage('form.accountNumber')"
        @blur="touchField('form.accountNumber')"
        non-label-wrapper
      >
        <template #label-right><FormFieldHelp topic="loanReference" /></template>
      </InputField>
    </div>
  </form>
</template>
