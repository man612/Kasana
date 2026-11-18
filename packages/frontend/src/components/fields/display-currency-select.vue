<script setup lang="ts">
import FieldLabel from '@/components/fields/components/field-label.vue';
import * as Select from '@/components/lib/ui/select';
import { useCurrencyName } from '@/composable';
import { useCurrenciesStore } from '@/stores';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

// Sentinel: Select requires strings; null (= "use base currency") maps to this value.
// The sentinel cannot collide with a real 3-letter currency code.
const BASE_CURRENCY_VALUE = 'base';

const props = defineProps<{
  modelValue: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const { formatCurrencyLabel } = useCurrencyName();
const { baseCurrency, systemCurrenciesVerbose } = storeToRefs(useCurrenciesStore());

const baseCurrencyCode = computed(() => baseCurrency.value?.currencyCode ?? '');
const isOpen = ref(false);
// The base currency is already offered as the first choice. Listing the same
// IDR option again makes the picker look like it contains two currencies.
const otherCurrencies = computed(() =>
  systemCurrenciesVerbose.value.linked.filter((item) => item.code !== baseCurrencyCode.value),
);

// Map external null → sentinel for the Select; sentinel → null when emitting.
const internalValue = computed(() =>
  !props.modelValue || props.modelValue === baseCurrencyCode.value ? BASE_CURRENCY_VALUE : props.modelValue,
);

// Select emits AcceptableValue; all option values here are strings.
const onSelect = (val: unknown) => {
  emit('update:modelValue', val === BASE_CURRENCY_VALUE || val == null ? null : String(val));
};
</script>

<template>
  <div>
    <FieldLabel :label="$t('forms.portfolioSettings.displayCurrencyLabel')">
      <Select.Select
        :model-value="internalValue"
        :open="isOpen"
        :disabled="disabled"
        @update:model-value="onSelect"
        @update:open="isOpen = $event"
      >
        <Teleport to="body">
          <Transition
            enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-150 ease-in motion-reduce:transition-none"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="isOpen"
              aria-hidden="true"
              class="pointer-events-auto fixed inset-0 z-(--z-over-dialog) bg-black/55 backdrop-blur-[2px]"
              @pointerdown.stop
              @click.stop.prevent="isOpen = false"
            />
          </Transition>
        </Teleport>
        <Select.SelectTrigger>
          <Select.SelectValue :placeholder="$t('forms.portfolioSettings.displayCurrencyPlaceholder')" />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem :value="BASE_CURRENCY_VALUE">
            {{ $t('forms.portfolioSettings.displayCurrencyBaseOption', { code: baseCurrencyCode }) }}
          </Select.SelectItem>
          <Select.SelectItem v-for="item of otherCurrencies" :key="item.code" :value="String(item.code)">
            {{ formatCurrencyLabel({ code: item.code, fallbackName: item.currency }) }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </FieldLabel>
    <p class="text-muted-foreground mt-1 text-xs">
      {{ $t('forms.portfolioSettings.displayCurrencyDescription') }}
    </p>
  </div>
</template>
