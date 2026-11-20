<script setup lang="ts">
import InputField from '@/components/fields/input-field.vue';
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import * as Dialog from '@/components/lib/ui/dialog';
import { CheckIcon, ChevronRightIcon, PencilIcon } from '@lucide/vue';
import { computed, ref, watch, type Component } from 'vue';

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
  /** Optional section heading; adjacent options with the same group are shown together. */
  group?: string;
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
    searchPlaceholder?: string;
    noResultsLabel?: string;
  }>(),
  { disabled: false, required: false },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const isOpen = ref(false);
const query = ref('');
const heading = ref<HTMLElement | null>(null);
watch(isOpen, (open) => {
  if (!open) query.value = '';
});
const visibleOptions = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  return term
    ? props.options.filter(({ label, group }) => `${label} ${group ?? ''}`.toLocaleLowerCase().includes(term))
    : props.options;
});
const onOpenAutoFocus = (event: Event) => {
  if (!props.searchPlaceholder) return;
  event.preventDefault();
  heading.value?.focus({ preventScroll: true });
};
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
          <Transition name="lajur-info-reveal" mode="out-in">
            <span :key="selected?.value ?? 'empty-option'" class="flex min-w-0 flex-1 items-center gap-2">
              <component
                :is="selected.icon"
                v-if="selected?.icon"
                class="size-4 shrink-0"
                :class="selected.iconClass"
              />
              <span class="min-w-0 flex-1 truncate" :class="!selected && 'text-muted-foreground'">
                {{ selected?.label ?? placeholder ?? label }}
              </span>
            </span>
          </Transition>
          <ChevronRightIcon class="text-muted-foreground size-4 shrink-0" />
        </button>
      </Dialog.DialogTrigger>
      <Dialog.DialogContent
        blur-overlay
        @open-auto-focus="onOpenAutoFocus"
        class="data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2 grid max-h-[min(85dvh,700px)] w-[calc(100vw-2rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 motion-reduce:animate-none"
      >
        <div ref="heading" tabindex="-1" class="border-border relative border-b px-4 py-4 pr-14 outline-none">
          <div v-if="$slots['header-action']" class="absolute top-3 right-12 z-10">
            <slot name="header-action" />
          </div>
          <Dialog.DialogTitle class="text-base font-semibold">{{ label }}</Dialog.DialogTitle>
          <Dialog.DialogDescription class="text-muted-foreground mt-1 text-xs">
            {{ placeholder ?? label }}
          </Dialog.DialogDescription>
          <InputField
            v-if="searchPlaceholder"
            v-model="query"
            class="mt-2"
            :placeholder="searchPlaceholder"
            :aria-label="searchPlaceholder"
          />
        </div>
        <div class="lajur-dialog-scroll min-h-0 space-y-1 overflow-y-auto overscroll-contain p-3">
          <TransitionGroup name="lajur-info-reveal">
            <p
              v-if="!visibleOptions.length && noResultsLabel"
              key="empty"
              role="status"
              class="text-muted-foreground px-3 py-4 text-sm"
            >
              {{ noResultsLabel }}
            </p>
            <div v-for="(option, index) in visibleOptions" :key="option.value">
              <p
                v-if="option.group && (index === 0 || option.group !== visibleOptions[index - 1]?.group)"
                class="text-muted-foreground px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wider uppercase"
                :class="index === 0 && 'pt-1'"
              >
                {{ option.group }}
              </p>
              <button
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
          </TransitionGroup>
        </div>
      </Dialog.DialogContent>
    </Dialog.Dialog>
    <FieldError :error-message="errorMessage" />
  </FieldLabel>
</template>
