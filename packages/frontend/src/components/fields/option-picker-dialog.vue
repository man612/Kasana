<script setup lang="ts">
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { Button } from '@/components/lib/ui/button';
import { createReusableTemplate } from '@vueuse/core';
import InputField from '@/components/fields/input-field.vue';
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import * as Dialog from '@/components/lib/ui/dialog';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, PencilIcon, SearchIcon } from '@lucide/vue';
import { computed, ref, watch, type Component } from 'vue';

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
  /** Optional section heading; adjacent options with the same group are shown together. */
  group?: string;
  icon?: Component;
  iconClass?: string;
  groupIcon?: Component;
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
    collapsibleGroups?: boolean;
    noResultsLabel?: string;
  }>(),
  { disabled: false, required: false },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const isOpen = ref(false);
const query = ref('');
const expandedGroups = ref<string[]>([]);
const [DefineOption, ReuseOption] = createReusableTemplate<{ option: PickerOption; showGroup?: boolean }>();
const groupedOptions = computed(() => {
  const groups = new Map<string, PickerOption[]>();
  for (const option of props.options) {
    const group = option.group ?? '';
    const options = groups.get(group);
    if (options) options.push(option);
    else groups.set(group, [option]);
  }
  return [...groups.entries()];
});
const showGroups = computed(() => props.collapsibleGroups && !query.value.trim());
const toggleGroup = (group: string) => {
  expandedGroups.value = expandedGroups.value.includes(group)
    ? expandedGroups.value.filter((item) => item !== group)
    : [...expandedGroups.value, group];
};
const heading = ref<HTMLElement | null>(null);
watch(isOpen, (open) => {
  if (!open) {
    query.value = '';
    expandedGroups.value = [];
  }
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
  <DefineOption v-slot="{ option, showGroup }">
    <Button
      variant="ghost"
      type="button"
      class="hover:bg-muted/60 focus-visible:ring-ring h-auto min-h-11 w-full justify-start rounded-lg px-3 py-2 text-left whitespace-normal transition-colors focus-visible:ring-2 focus-visible:outline-none"
      :class="modelValue === option.value && 'bg-primary/10'"
      :aria-pressed="modelValue === option.value"
      @click="pick(option.value)"
    >
      <span
        v-if="option.icon"
        class="flex size-9 shrink-0 items-center justify-center rounded-lg"
        :class="option.iconClass ?? 'bg-muted text-muted-foreground'"
      >
        <component :is="option.icon" class="size-4" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium">{{ option.label }}</span>
        <span
          v-if="option.description || (showGroup && option.group)"
          class="text-muted-foreground mt-0.5 block text-xs leading-relaxed"
          >{{ showGroup && option.group ? option.group : option.description }}</span
        >
      </span>
      <CheckIcon v-if="modelValue === option.value" class="text-primary-text size-4 shrink-0" />
    </Button>
  </DefineOption>
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
        <div ref="heading" tabindex="-1" class="border-border relative border-b px-4 py-4 outline-none">
          <div v-if="$slots['header-action']" class="absolute top-3 right-12 z-10">
            <slot name="header-action" />
          </div>
          <Dialog.DialogTitle class="pr-14 text-base font-semibold">{{ label }}</Dialog.DialogTitle>
          <Dialog.DialogDescription class="text-muted-foreground mt-1 pr-14 text-xs">
            {{ placeholder ?? label }}
          </Dialog.DialogDescription>
          <InputField
            v-if="searchPlaceholder"
            v-model="query"
            class="mt-2"
            :placeholder="searchPlaceholder"
            :aria-label="searchPlaceholder"
            leading-icon-css-class="pointer-events-none px-3"
          >
            <template #iconLeading>
              <SearchIcon class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            </template>
          </InputField>
        </div>
        <div class="lajur-dialog-scroll min-h-0 space-y-1 overflow-y-auto overscroll-contain p-3">
          <template v-if="showGroups">
            <div v-for="[group, options] in groupedOptions" :key="group">
              <Button
                v-if="group"
                variant="ghost"
                class="h-auto min-h-12 w-full justify-start rounded-lg px-2 text-left whitespace-normal"
                :aria-expanded="expandedGroups.includes(group)"
                @click="toggleGroup(group)"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-lg"
                  :class="options[0]?.iconClass ?? 'bg-muted text-muted-foreground'"
                >
                  <component :is="options[0]?.groupIcon ?? options[0]?.icon" class="size-4" />
                </span>
                <span class="min-w-0 flex-1">{{ group }}</span>
                <ChevronDownIcon
                  class="text-muted-foreground size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200"
                  :class="expandedGroups.includes(group) && 'rotate-180'"
                />
              </Button>
              <LayoutCollapse :open="!group || expandedGroups.includes(group)">
                <div class="border-border/70 ml-6 border-l pl-2">
                  <ReuseOption v-for="option in options" :key="option.value" :option="option" />
                </div>
              </LayoutCollapse>
            </div>
          </template>
          <TransitionGroup v-else name="lajur-info-reveal">
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
                v-if="
                  !collapsibleGroups &&
                  option.group &&
                  (index === 0 || option.group !== visibleOptions[index - 1]?.group)
                "
                class="text-muted-foreground px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wider uppercase"
                :class="index === 0 && 'pt-1'"
              >
                {{ option.group }}
              </p>
              <ReuseOption :option="option" :show-group="!!collapsibleGroups" />
            </div>
          </TransitionGroup>
        </div>
      </Dialog.DialogContent>
    </Dialog.Dialog>
    <FieldError :error-message="errorMessage" />
  </FieldLabel>
</template>
