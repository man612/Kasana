<script lang="ts" setup>
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import type { TransactionDialogSession } from '@/components/dialogs/manage-transaction/composables/transaction-dialog-close';
import { ref, watch } from 'vue';
import * as Dialog from '@/components/lib/ui/dialog';
import * as Drawer from '@/components/lib/ui/drawer';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
  /**
   * Narrow-layout flag supplied by the view: the list derives it from the
   * viewport, the table from its container width — so it stays a prop here
   * instead of being computed inside.
   */
  mobile: boolean;
  /** Compact (max-w-lg) desktop dialog instead of the full-width editor. */
  isCompact?: boolean;
  session: TransactionDialogSession | null;
}>();
const confirmOpen = ref(false);
const hasChanges = () => props.session?.hasUnsavedChanges() === true;
const isSaving = () => props.session?.isSaving() === true;
const requestOpen = (value: boolean) => {
  if (!value && (!open.value || isSaving())) return;
  if (!value && hasChanges()) confirmOpen.value = true;
  else open.value = value;
};
const requestDismiss = (event: Event) => {
  if (isSaving()) return event.preventDefault();
  if (!hasChanges()) return;
  event.preventDefault();
  confirmOpen.value = true;
};
watch(open, (value) => {
  if (!value) confirmOpen.value = false;
});
</script>

<template>
  <Drawer.Drawer v-if="mobile" :dismissible="!hasChanges() && !isSaving()" :open="open" @update:open="requestOpen">
    <Drawer.DrawerContent
      adaptive-height
      custom-indicator
      @pointer-down-outside="requestDismiss"
      @escape-key-down="requestDismiss"
    >
      <Drawer.DrawerTitle class="sr-only">{{ $t('transactions.list.detailsTitle') }}</Drawer.DrawerTitle>
      <Drawer.DrawerDescription class="sr-only">{{
        $t('transactions.list.detailsDescription')
      }}</Drawer.DrawerDescription>
      <slot :request-close="() => requestOpen(false)" />
    </Drawer.DrawerContent>
  </Drawer.Drawer>

  <Dialog.Dialog v-else :open="open" @update:open="requestOpen">
    <Dialog.DialogContent
      custom-close
      @pointer-down-outside="requestDismiss"
      @escape-key-down="requestDismiss"
      :class="['max-h-[90dvh] w-full overflow-hidden p-0', isCompact ? 'max-w-lg' : 'max-w-225']"
    >
      <Dialog.DialogTitle class="sr-only">{{ $t('transactions.list.detailsTitle') }}</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">{{
        $t('transactions.list.detailsDescription')
      }}</Dialog.DialogDescription>
      <slot :request-close="() => requestOpen(false)" />
    </Dialog.DialogContent>
  </Dialog.Dialog>
  <ResponsiveAlertDialog
    v-model:open="confirmOpen"
    :confirm-label="$t('dialogs.manageTransaction.form.discardAction')"
    confirm-variant="destructive"
    @confirm="open = false"
  >
    <template #title>{{ $t('dialogs.manageTransaction.form.discardTitle') }}</template>
    <template #description>{{ $t('dialogs.manageTransaction.form.discardDetails') }}</template>
  </ResponsiveAlertDialog>
</template>
