<script setup lang="ts">
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import * as Dialog from '@/components/lib/ui/dialog';
import { CheckIcon, ChevronRightIcon, PencilIcon } from '@lucide/vue';
import { computed, ref, type Component } from 'vue';

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
  icon?: Component;
  iconClass?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    label: string;
    placeholder?: string;
    options: PickerOption[];
    disabled?: boolean;
    errorMessage?: string;
    required?: boolean;
    iconOnly?: boolean;
  }>(),
  { disabled: false, required: false },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const isOpen = ref(false);
const selected = computed(() => props.options.find((option) => option.value === props.modelValue));
const pick = (value: string) => {
  emit('update:modelValue', value);
  isOpen.value = false;
};
</script>

<template>
  <FieldLabel :label="iconOnly ? undefined : label" only-template>
    <template v-if="$slots['label-right']" #label-right><slot name="label-right" /></template>
    <template #label-after>
      <span v-if="required" class="text-destructive" aria-hidden="true">*</span>
    </template>
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
          :aria-invalid="Boolean(errorMessage)"
          :aria-required="required"
          class="border-input bg-input-background hover:bg-muted/60 focus-visible:ring-ring flex h-10 w-full min-w-0 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 md:h-9"
          :class="errorMessage && 'border-destructive'"
        >
          <component :is="selected.icon" v-if="selected?.icon" class="size-4 shrink-0" :class="selected.iconClass" />
          <span class="min-w-0 flex-1 truncate" :class="!selected && 'text-muted-foreground'">
            {{ selected?.label ?? placeholder ?? label }}
          </span>
          <ChevronRightIcon class="text-muted-foreground size-4 shrink-0" />
        </button>
      </Dialog.DialogTrigger>
      <Dialog.DialogContent
        blur-overlay
        class="grid max-h-[min(85dvh,700px)] w-[calc(100vw-2rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0"
      >
        <div class="border-border border-b px-4 py-4 pr-14">
          <Dialog.DialogTitle class="text-base font-semibold">{{ label }}</Dialog.DialogTitle>
          <Dialog.DialogDescription class="text-muted-foreground mt-1 text-xs">
            {{ placeholder ?? label }}
          </Dialog.DialogDescription>
        </div>
        <div class="lajur-dialog-scroll min-h-0 space-y-1 overflow-y-auto overscroll-contain p-3">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="hover:bg-muted/60 focus-visible:ring-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            :class="modelValue === option.value && 'bg-primary/10'"
            :aria-pressed="modelValue === option.value"
            @click="pick(option.value)"
          >
            <span
              v-if="option.icon"
              class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"
              :class="option.iconClass"
            >
              <component :is="option.icon" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium">{{ option.label }}</span>
              <span v-if="option.description" class="text-muted-foreground mt-0.5 block text-xs leading-relaxed">{{
                option.description
              }}</span>
            </span>
            <CheckIcon v-if="modelValue === option.value" class="text-primary size-4 shrink-0" />
          </button>
        </div>
      </Dialog.DialogContent>
    </Dialog.Dialog>
    <FieldError :error-message="errorMessage" />
  </FieldLabel>
</template>
