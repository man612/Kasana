<script lang="ts" setup>
import * as AlertDialog from '@/components/lib/ui/alert-dialog';
import { type ButtonVariantProps } from '@/components/lib/ui/button';
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
  }>(),
  { cancelLabel: undefined, confirmLabel: undefined, confirmVariant: 'default', confirmDisabled: false },
);
const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
  cancel: [];
}>();
const isOpen = useVModel(props, 'open', emit, { passive: true });
const cancelLabel = computed(() => props.cancelLabel || t('common.actions.cancel'));
const confirmLabel = computed(() => props.confirmLabel || t('common.actions.confirm'));
</script>

<template>
  <AlertDialog.AlertDialog v-model:open="isOpen">
    <AlertDialog.AlertDialogContent class="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl p-5 sm:max-w-lg sm:p-6">
      <AlertDialog.AlertDialogHeader>
        <AlertDialog.AlertDialogTitle><slot name="title" /></AlertDialog.AlertDialogTitle>
        <AlertDialog.AlertDialogDescription as="div"><slot name="description" /></AlertDialog.AlertDialogDescription>
      </AlertDialog.AlertDialogHeader>
      <slot />
      <AlertDialog.AlertDialogFooter class="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
        <AlertDialog.AlertDialogCancel class="min-h-11 flex-1" @click="emit('cancel')">{{ cancelLabel }}</AlertDialog.AlertDialogCancel>
        <AlertDialog.AlertDialogAction :variant="confirmVariant" :disabled="confirmDisabled" class="min-h-11 flex-1" @click="emit('confirm')">{{ confirmLabel }}</AlertDialog.AlertDialogAction>
      </AlertDialog.AlertDialogFooter>
    </AlertDialog.AlertDialogContent>
  </AlertDialog.AlertDialog>
</template>
