<template>
  <FieldLabel :label="label" :only-template="embedded || !!$slots['label-right']">
    <template v-if="$slots['label-right']" #label-right>
      <slot name="label-right" />
    </template>
    <div class="relative">
      <input
        ref="inputRef"
        v-bind="$attrs"
        type="text"
        inputmode="decimal"
        :value="displayValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autofocus="autofocus"
        autocomplete="off"
        spellcheck="false"
        :class="
          cn(
            'border-input bg-input-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:h-9',
            errorMessage && 'border-destructive',
            embedded && 'h-full border-0 bg-transparent px-2 focus-visible:ring-0 focus-visible:ring-offset-0 md:h-full',
            $slots.iconTrailing && 'pr-14',
            ($attrs.class as string) ?? '',
          )
        "
        @input="onInput"
        @blur="emit('blur')"
      />
      <div v-if="$slots.iconTrailing" class="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <slot name="iconTrailing" />
      </div>
    </div>
    <FieldError :error-message="errorMessage" />
  </FieldLabel>
</template>

<script setup lang="ts">
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import {
  caretOffsetAfterDigits,
  countDigitsBeforeCaret,
  getAmountSeparators,
  parseAmountInput,
} from '@/components/fields/utils/formatted-amount';
import { cn } from '@/lib/utils';
import { computed, nextTick, onMounted, ref } from 'vue';

const props = defineProps<{
  modelValue?: number | null;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  errorMessage?: string;
  embedded?: boolean;
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
  blur: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

// Tail the numeric model can't represent (trailing '.' or zeros, e.g. "1234.50") —
// keeps the input showing exactly what the user typed mid-edit.
const trailingFragment = ref<string>('');

// IDR-style numbers (20.000,50) independently of the browser's locale.
const separators = getAmountSeparators('id-ID');

// Locale grouping/decimal separators, matching the rest of the app's number rendering.
const formatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const formatNumber = (value: number): string => {
  if (Number.isNaN(value)) return '';
  return formatter.format(value);
};

const displayValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) return '';
  // fragment uses a canonical '.' — swap in the locale's decimal separator to match the formatter.
  const fragment = trailingFragment.value.replace('.', separators.decimal);
  return `${formatNumber(props.modelValue)}${fragment}`;
});

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const raw = target.value;
  const caretBefore = target.selectionStart ?? raw.length;
  const digitsBeforeCaret = countDigitsBeforeCaret({
    text: raw,
    caret: caretBefore,
    decimalSeparator: separators.decimal,
  });

  const { fragment, numeric } = parseAmountInput({
    raw,
    decimalSeparator: separators.decimal,
    groupSeparator: separators.group,
  });
  trailingFragment.value = fragment;

  if (numeric !== props.modelValue) {
    emit('update:modelValue', numeric);
  }

  // Format immediately on EACH keystroke, not after blur or the parent rerender.
  const formattedNow = numeric === null ? '' : formatNumber(numeric) + fragment.replace('.', separators.decimal);
  target.value = formattedNow;
  const caretAfter = caretOffsetAfterDigits({
    text: formattedNow,
    digitCount: digitsBeforeCaret,
    decimalSeparator: separators.decimal,
  });
  target.setSelectionRange(caretAfter, caretAfter);

  nextTick(() => {
    const formatted = displayValue.value;
    const nextCaret = caretOffsetAfterDigits({
      text: formatted,
      digitCount: digitsBeforeCaret,
      decimalSeparator: separators.decimal,
    });
    inputRef.value?.setSelectionRange(nextCaret, nextCaret);
  });
};

onMounted(() => { if (props.autofocus) inputRef.value?.focus(); });

defineExpose({
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select(),
});
</script>
