<script lang="ts">
import { shallowRef } from 'vue';

const activeHelp = shallowRef<string>();
export const closeContextualHelp = () => {
  activeHelp.value = undefined;
};
</script>

<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/lib/ui/popover';
import { computed, onScopeDispose, useId, watch } from 'vue';

const props = defineProps<{
  title?: string;
  content?: string;
  example?: string;
  compact?: boolean;
  disabled?: boolean;
}>();

const id = useId();
const open = computed({
  get: () => activeHelp.value === id,
  set: (value) => {
    if (value && !props.disabled) activeHelp.value = id;
    else if (activeHelp.value === id) activeHelp.value = undefined;
  },
});
watch(
  () => props.disabled,
  (value) => {
    if (value) open.value = false;
  },
);
onScopeDispose(() => {
  open.value = false;
});
const onCloseAutoFocus = (event: Event) => {
  if (activeHelp.value && activeHelp.value !== id) event.preventDefault();
};
</script>

<template>
  <Popover v-if="compact" v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverContent
      side="top"
      :aria-label="title || $t('common.contextHelp.title')"
      class="z-[calc(var(--z-over-dialog)_+_1)] w-65 max-w-[calc(100vw-1.5rem)] space-y-1.5 rounded-xl p-3.5 text-sm"
      @close-auto-focus="onCloseAutoFocus"
    >
      <h2 class="text-foreground font-semibold">{{ title || $t('common.contextHelp.title') }}</h2>
      <div class="text-muted-foreground leading-relaxed">
        <slot>{{ content }}</slot>
      </div>
    </PopoverContent>
  </Popover>

  <ResponsiveDialog
    v-else
    v-model:open="open"
    raised
    mobile-presentation="center"
    dialog-content-class="max-w-sm"
    @close-auto-focus="onCloseAutoFocus"
  >
    <template #trigger><slot name="trigger" /></template>
    <template #title>{{ title || $t('common.contextHelp.title') }}</template>
    <template #description>{{ $t('common.contextHelp.description') }}</template>
    <div class="text-foreground space-y-3 text-sm leading-relaxed">
      <slot
        ><p>{{ content }}</p></slot
      >
      <div v-if="example" class="border-primary/45 bg-muted/40 border-l-2 py-2 pr-3 pl-3">
        <p class="text-foreground font-semibold">{{ $t('common.contextHelp.example') }}</p>
        <p class="text-muted-foreground">{{ example }}</p>
      </div>
    </div>
  </ResponsiveDialog>
</template>
