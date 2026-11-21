<script lang="ts" setup>
import * as AlertDialog from '@/components/lib/ui/alert-dialog';
import { Button, type ButtonVariantProps } from '@/components/lib/ui/button';
import { TriangleAlertIcon } from '@lucide/vue';
import { useVModel } from '@vueuse/core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const props = withDefaults(
  defineProps<{
    open?: boolean;
    cancelLabel?: string;
    confirmLabel?: string;
    confirmVariant?: ButtonVariantProps['variant'];
    confirmDisabled?: boolean;
    confirmLoading?: boolean;
    backdropDismissible?: boolean;
  }>(),
  {
    cancelLabel: undefined,
    confirmLabel: undefined,
    confirmVariant: 'default',
    confirmDisabled: false,
    confirmLoading: undefined,
    backdropDismissible: true,
  },
);
const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
  cancel: [];
}>();
const isOpen = useVModel(props, 'open', emit, { passive: true });
const cancelLabel = computed(() => props.cancelLabel || t('common.actions.cancel'));
const confirmLabel = computed(() => props.confirmLabel || t('common.actions.confirm'));
const isDestructive = computed(() => props.confirmVariant?.includes('destructive'));
const blocked = computed(() => props.confirmDisabled || props.confirmLoading);
const cancelByBackdrop = () => {
  if (!props.backdropDismissible || blocked.value) return;
  isOpen.value = false;
  emit('cancel');
};
</script>

<template>
  <AlertDialog.AlertDialog v-model:open="isOpen">
    <AlertDialog.AlertDialogContent
      :on-backdrop-click="cancelByBackdrop"
      class="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[27rem] gap-4 overflow-y-auto rounded-2xl p-5 sm:p-6"
      @escape-key-down="
        (event: Event) => {
          if (confirmLoading) event.preventDefault();
        }
      "
    >
      <AlertDialog.AlertDialogHeader class="text-left!">
        <div class="flex items-start gap-3">
          <span
            v-if="isDestructive"
            class="bg-destructive/10 text-destructive-text grid size-9 shrink-0 place-items-center rounded-lg"
          >
            <TriangleAlertIcon class="size-4" aria-hidden="true" />
          </span>
          <div class="min-w-0 space-y-1.5">
            <AlertDialog.AlertDialogTitle class="text-base leading-snug"
              ><slot name="title"
            /></AlertDialog.AlertDialogTitle>
            <AlertDialog.AlertDialogDescription as="div" class="leading-relaxed"
              ><slot name="description"
            /></AlertDialog.AlertDialogDescription>
          </div>
        </div>
      </AlertDialog.AlertDialogHeader>
      <slot />
      <AlertDialog.AlertDialogFooter class="border-border/70 mt-0 grid grid-cols-2 gap-2 border-t pt-4">
        <AlertDialog.AlertDialogCancel
          :disabled="confirmLoading"
          class="transition-[background-color,color,scale] motion-safe:active:scale-[0.98]"
          @click="emit('cancel')"
          >{{ cancelLabel }}</AlertDialog.AlertDialogCancel
        >
        <Button
          v-if="confirmLoading !== undefined"
          :variant="confirmVariant"
          :disabled="blocked"
          :loading="confirmLoading"
          class="text-center transition-[background-color,color,scale] motion-safe:active:scale-[0.98]"
          @click="emit('confirm')"
          >{{ confirmLabel }}</Button
        >
        <AlertDialog.AlertDialogAction
          v-else
          :variant="confirmVariant"
          :disabled="blocked"
          class="text-center transition-[background-color,color,scale] motion-safe:active:scale-[0.98]"
          @click="emit('confirm')"
          >{{ confirmLabel }}</AlertDialog.AlertDialogAction
        >
      </AlertDialog.AlertDialogFooter>
    </AlertDialog.AlertDialogContent>
  </AlertDialog.AlertDialog>
</template>
