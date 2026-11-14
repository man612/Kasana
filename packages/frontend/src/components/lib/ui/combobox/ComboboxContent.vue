<script setup lang="ts">
import { cn } from '@/lib/utils';
import { reactiveOmit } from '@vueuse/core';
import type { ComboboxContentProps as RekaComboboxContentProps } from 'reka-ui';
import { ComboboxContent } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

interface PointerDownOutsideEvent extends Event {
  type: string;
  detail: {
    originalEvent: PointerEvent;
  };
}

interface FocusOutsideEvent extends Event {
  type: string;
  detail: {
    originalEvent: FocusEvent;
  };
}

const props = defineProps<
  RekaComboboxContentProps & {
    class?: HTMLAttributes['class'];
    forceMount?: boolean;
  }
>();

const emits = defineEmits<{
  (e: 'escapeKeyDown', event: KeyboardEvent): void;
  (e: 'interactOutside', event: PointerDownOutsideEvent | FocusOutsideEvent): void;
}>();

const delegatedProps = reactiveOmit(props, 'class');
</script>

<template>
  <ComboboxContent
    v-bind="delegatedProps"
    :class="cn(
        'bg-background border-input mt-2 w-full rounded-md border shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        props.class,
      )"
    @escape-key-down="emits('escapeKeyDown', $event)"
    @interact-outside="emits('interactOutside', $event)"
  >
    <slot />
  </ComboboxContent>
</template>
