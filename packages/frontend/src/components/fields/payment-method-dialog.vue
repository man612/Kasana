<script setup lang="ts">
import type { VerbosePaymentType } from '@/common/const';
import { VERBOSE_PAYMENT_TYPES } from '@/common/const';
import DialogHeaderActions from '@/components/common/dialog-header-actions.vue';
import ContextualHelp from '@/components/common/contextual-help.vue';
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import { Button } from '@/components/lib/ui/button';
import * as Dialog from '@/components/lib/ui/dialog';
import { PAYMENT_TYPES } from '@bt/shared/types';
import {
  ArrowLeftRightIcon,
  BanknoteIcon,
  Building2Icon,
  CheckIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  CreditCardIcon,
  GiftIcon,
  GlobeIcon,
  LandmarkIcon,
  NfcIcon,
  PencilIcon,
  QrCodeIcon,
  ReceiptIcon,
  RepeatIcon,
  SmartphoneIcon,
  WalletIcon,
} from '@lucide/vue';
import { computed, ref, type Component } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    modelValue: VerbosePaymentType | null;
    label: string;
    disabled?: boolean;
    required?: boolean;
    errorMessage?: string;
    animateError?: boolean;
    iconOnly?: boolean;
  }>(),
  { disabled: false, required: false },
);
const emit = defineEmits<{ 'update:modelValue': [value: VerbosePaymentType | null] }>();
const { t } = useI18n();
const isOpen = ref(false);
const iconColors = [
  'bg-blue-500/15 text-blue-500 dark:text-blue-300',
  'bg-emerald-500/15 text-emerald-500 dark:text-emerald-300',
  'bg-violet-500/15 text-violet-500 dark:text-violet-300',
  'bg-amber-500/15 text-amber-500 dark:text-amber-300',
  'bg-cyan-500/15 text-cyan-500 dark:text-cyan-300',
  'bg-pink-500/15 text-pink-500 dark:text-pink-300',
  'bg-orange-500/15 text-orange-500 dark:text-orange-300',
  'bg-teal-500/15 text-teal-500 dark:text-teal-300',
];
const iconClass = (key: PAYMENT_TYPES) => iconColors[Math.max(0, orderedTypes.indexOf(key)) % iconColors.length];

const icons: Partial<Record<PAYMENT_TYPES, Component>> = {
  [PAYMENT_TYPES.qris]: QrCodeIcon,
  [PAYMENT_TYPES.bankTransfer]: ArrowLeftRightIcon,
  [PAYMENT_TYPES.eWallet]: WalletIcon,
  [PAYMENT_TYPES.cash]: BanknoteIcon,
  [PAYMENT_TYPES.debitCard]: CreditCardIcon,
  [PAYMENT_TYPES.virtualAccount]: Building2Icon,
  [PAYMENT_TYPES.creditCard]: CreditCardIcon,
  [PAYMENT_TYPES.emoneyCard]: NfcIcon,
  [PAYMENT_TYPES.autoDebit]: RepeatIcon,
  [PAYMENT_TYPES.payLater]: ReceiptIcon,
  [PAYMENT_TYPES.mobilePayment]: SmartphoneIcon,
  [PAYMENT_TYPES.voucher]: GiftIcon,
  [PAYMENT_TYPES.webPayment]: GlobeIcon,
};
const orderedTypes: PAYMENT_TYPES[] = [
  PAYMENT_TYPES.qris,
  PAYMENT_TYPES.bankTransfer,
  PAYMENT_TYPES.eWallet,
  PAYMENT_TYPES.cash,
  PAYMENT_TYPES.debitCard,
  PAYMENT_TYPES.virtualAccount,
  PAYMENT_TYPES.creditCard,
  PAYMENT_TYPES.emoneyCard,
  PAYMENT_TYPES.autoDebit,
  PAYMENT_TYPES.payLater,
  PAYMENT_TYPES.mobilePayment,
  PAYMENT_TYPES.webPayment,
  PAYMENT_TYPES.voucher,
];
const options = computed(() =>
  orderedTypes.flatMap((key) => VERBOSE_PAYMENT_TYPES.filter((item) => item.value === key)),
);
const selectedIcon = computed(() => props.modelValue && icons[props.modelValue.value]);
const optionHelp = (key: PAYMENT_TYPES) => t('dialogs.manageTransaction.paymentMethodHelp.' + key);
const pick = (value: VerbosePaymentType | null) => {
  emit('update:modelValue', value);
  isOpen.value = false;
};
</script>

<template>
  <FieldLabel :label="iconOnly ? undefined : label" only-template>
    <template v-if="$slots['label-right']" #label-right><slot name="label-right" /></template>
    <template #label-after><span v-if="required" class="text-destructive" aria-hidden="true">*</span></template>
    <div class="flex items-stretch gap-1.5">
      <Dialog.Dialog v-model:open="isOpen">
        <Dialog.DialogTrigger as-child>
          <button
            v-if="iconOnly"
            type="button"
            :disabled="disabled"
            :aria-label="label"
            :title="label"
            class="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 disabled:opacity-50"
          >
            <PencilIcon class="size-3.5" />
          </button>
          <button
            v-else
            type="button"
            :disabled="disabled"
            :aria-label="label"
            :aria-required="required"
            :aria-invalid="Boolean(errorMessage)"
            :class="errorMessage && 'border-destructive'"
            class="border-input bg-input-background hover:bg-muted/60 focus-visible:ring-ring flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-9"
            data-testid="payment-method-dialog-trigger"
          >
            <component :is="selectedIcon" v-if="selectedIcon" class="text-muted-foreground size-4 shrink-0" />
            <span class="min-w-0 flex-1 truncate">
              {{ modelValue ? t(modelValue.label) : t('dialogs.manageTransaction.paymentMethodHelp.placeholder') }}
            </span>
            <ChevronRightIcon class="text-muted-foreground size-4 shrink-0" />
          </button>
        </Dialog.DialogTrigger>
        <Dialog.DialogContent
          blur-overlay
          custom-close
          class="data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2 max-h-[88dvh] w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden rounded-2xl p-0 data-[state=open]:duration-200 motion-reduce:animate-none"
          data-testid="payment-method-dialog"
        >
          <div class="border-border grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b px-4 py-3">
            <div class="self-center">
              <Dialog.DialogTitle class="text-base font-semibold">
                {{ t('dialogs.manageTransaction.paymentMethodHelp.title') }}
              </Dialog.DialogTitle>
              <Dialog.DialogDescription class="text-muted-foreground mt-1 text-xs leading-relaxed">
                {{ t('dialogs.manageTransaction.paymentMethodHelp.overview') }}
              </Dialog.DialogDescription>
            </div>
            <DialogHeaderActions :close="() => (isOpen = false)">
              <ContextualHelp
                :title="t('dialogs.manageTransaction.paymentMethodHelp.title')"
                :content="t('dialogs.manageTransaction.paymentMethodHelp.longExplanation')"
              >
                <template #trigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="text-muted-foreground size-11"
                    :aria-label="
                      t('dialogs.manageTransaction.paymentMethodHelp.learnMore', {
                        name: t('dialogs.manageTransaction.paymentMethodHelp.title'),
                      })
                    "
                  >
                    <CircleHelpIcon class="size-5" aria-hidden="true" />
                  </Button>
                </template>
              </ContextualHelp>
            </DialogHeaderActions>
          </div>
          <div class="max-h-[min(66dvh,540px)] space-y-1 overflow-y-auto overscroll-contain p-3">
            <div
              v-for="option in options"
              :key="option.value"
              class="group hover:bg-muted/40 focus-within:bg-muted/40 flex items-stretch gap-1 rounded-lg border border-transparent transition-[background-color,border-color,transform] duration-200"
              :class="modelValue?.value === option.value && 'border-primary/40 bg-primary/10'"
            >
              <button
                type="button"
                class="flex min-h-12 min-w-0 flex-1 items-center gap-3 p-2 text-left"
                :aria-pressed="modelValue?.value === option.value"
                @click="pick(option)"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  :class="iconClass(option.value)"
                >
                  <component :is="icons[option.value] || LandmarkIcon" class="size-4" />
                </span>
                <span class="min-w-0 flex-1 text-sm font-medium">{{ t(option.label) }}</span>
                <CheckIcon v-if="modelValue?.value === option.value" class="text-primary size-4 shrink-0" />
              </button>
              <ContextualHelp :title="t(option.label)" :content="optionHelp(option.value)">
                <template #trigger>
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center self-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
                    :aria-label="t('dialogs.manageTransaction.paymentMethodHelp.learnMore', { name: t(option.label) })"
                  >
                    <CircleHelpIcon class="size-4" />
                  </button>
                </template>
              </ContextualHelp>
            </div>
            <button
              v-if="!required"
              type="button"
              class="text-muted-foreground hover:bg-muted/40 mt-2 w-full rounded-lg border border-dashed px-3 py-2 text-left text-sm"
              @click="pick(null)"
            >
              {{ t('common.paymentTypes.none') }}
            </button>
          </div>
        </Dialog.DialogContent>
      </Dialog.Dialog>
    </div>
    <FieldError :animated="animateError" :error-message="errorMessage" />
  </FieldLabel>
</template>
