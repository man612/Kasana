<script lang="ts" setup>
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import type { TransactionDialogSession } from '@/components/dialogs/manage-transaction/composables/transaction-dialog-close';
import { loadTransactionById } from '@/api/transactions';
import { ensureChunkLoaded } from '@/i18n';
import { captureException } from '@/lib/sentry';
import type { AccountModel, TransactionModel } from '@bt/shared/types';
import { createReusableTemplate } from '@vueuse/core';
import { useRoute } from 'vue-router';
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue';
import * as Dialog from '@/components/lib/ui/dialog';
import * as Drawer from '@/components/lib/ui/drawer';

import TransactionReadView from './transaction-read-view.vue';

const LoanPaymentForm = defineAsyncComponent(async () => {
  await ensureChunkLoaded('pages/loans');
  return import('@/pages/loans/components/loan-payment-dialog/loan-payment-form.vue');
});

const [DefineBody, UseBody] = createReusableTemplate();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ committed: [] }>();

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
  transaction?: TransactionModel;
  oppositeTransaction?: TransactionModel;
  loanAccount?: AccountModel;
}>();
const confirmOpen = ref(false);
const hasChanges = () => (loanSession.value ?? props.session)?.hasUnsavedChanges() === true;
const isSaving = () => (loanSession.value ?? props.session)?.isSaving() === true;
const route = useRoute();
const editing = ref(false);
const loanSession = shallowRef<TransactionDialogSession | null>(null);
const opener = shallowRef<HTMLElement | null>(null);
const fresh = shallowRef<TransactionModel>();
const freshOpposite = shallowRef<TransactionModel>();
const selected = computed(() => fresh.value ?? props.transaction);
const opposite = computed(() => freshOpposite.value ?? props.oppositeTransaction);
let committed = false;
let requestVersion = 0;

const close = () => {
  open.value = false;
};
const requestOpen = (value: boolean) => {
  if (value) {
    open.value = true;
    return;
  }
  if (!open.value || isSaving()) return;
  if (!editing.value) close();
  else if (hasChanges()) confirmOpen.value = true;
  else editing.value = false;
};
const requestDismiss = (event: Event) => {
  if (!editing.value && !isSaving()) return;
  event.preventDefault();
  requestOpen(false);
};
const refreshDetail = async () => {
  const current = selected.value;
  if (!current) return;
  const version = ++requestVersion;
  try {
    const otherId = opposite.value?.id;
    const [updated, other] = await Promise.all([
      loadTransactionById({ id: current.id }),
      otherId ? loadTransactionById({ id: otherId }).catch(() => undefined) : undefined,
    ]);
    if (version !== requestVersion || !open.value) return;
    if (updated) fresh.value = updated;
    if (other) freshOpposite.value = other;
  } catch (error) {
    captureException({ error, context: { source: 'transaction-read-view', transactionId: current.id } });
  }
};
const onCommit = () => {
  committed = true;
  emit('committed');
};
const finishEditing = () => {
  if (!open.value) return;
  if (!committed) {
    close();
    return;
  }
  committed = false;
  void refreshDetail();
  editing.value = false;
};
watch(
  () => [open.value, props.transaction?.id] as const,
  ([visible], [wasVisible]) => {
    requestVersion += 1;
    confirmOpen.value = false;
    if (!visible) return;
    if (!wasVisible) opener.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    committed = false;
    editing.value = false;
    fresh.value = undefined;
    freshOpposite.value = undefined;
    void refreshDetail();
  },
);
watch(() => route.fullPath, close);
const focusView = (element: Element) => {
  element.querySelector<HTMLElement>('[data-transaction-heading]')?.focus({ preventScroll: true });
};
const restoreFocus = (event: Event) => {
  const previous = opener.value;
  if (!previous?.isConnected || open.value) return;
  event.preventDefault();
  previous.focus({ preventScroll: true });
};
</script>

<template>
  <DefineBody>
    <div class="relative grid min-h-0 overflow-hidden">
      <Transition :name="editing ? 'lajur-detail-edit' : 'lajur-detail-read'" @after-enter="focusView">
        <TransactionReadView
          v-if="selected && !editing"
          key="read"
          :transaction="selected"
          :opposite-transaction="opposite"
          :editable="selected.canEdit !== false"
          @edit="editing = true"
          @close="close"
        />
        <div v-else key="edit" class="grid min-h-0 overflow-hidden">
          <LoanPaymentForm
            v-if="loanAccount"
            ref="loanSession"
            :loan-account="loanAccount"
            :transaction="selected"
            :opposite-transaction="opposite"
            @committed="onCommit"
            @close-modal="finishEditing"
          />
          <slot
            v-else
            :request-close="() => requestOpen(false)"
            :transaction="selected"
            :opposite-transaction="opposite"
            :committed="onCommit"
            :finish="finishEditing"
          />
        </div>
      </Transition>
    </div>
  </DefineBody>
  <Drawer.Drawer v-if="mobile" :dismissible="!editing" :open="open" @update:open="requestOpen">
    <Drawer.DrawerContent
      adaptive-height
      intrinsic-height-motion
      custom-indicator
      @pointer-down-outside="requestDismiss"
      @escape-key-down="requestDismiss"
      @close-auto-focus="restoreFocus"
    >
      <Drawer.DrawerTitle class="sr-only">{{ $t('transactions.list.detailsTitle') }}</Drawer.DrawerTitle>
      <Drawer.DrawerDescription class="sr-only">{{
        $t('transactions.list.detailsDescription')
      }}</Drawer.DrawerDescription>
      <UseBody />
    </Drawer.DrawerContent>
  </Drawer.Drawer>

  <Dialog.Dialog v-else :open="open" @update:open="requestOpen">
    <Dialog.DialogContent
      custom-close
      @pointer-down-outside="requestDismiss"
      @escape-key-down="requestDismiss"
      @close-auto-focus="restoreFocus"
      :class="['max-h-[90dvh] w-full overflow-hidden p-0', !editing || isCompact ? 'max-w-lg' : 'max-w-225']"
    >
      <Dialog.DialogTitle class="sr-only">{{ $t('transactions.list.detailsTitle') }}</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">{{
        $t('transactions.list.detailsDescription')
      }}</Dialog.DialogDescription>
      <UseBody />
    </Dialog.DialogContent>
  </Dialog.Dialog>
  <ResponsiveAlertDialog
    v-model:open="confirmOpen"
    :confirm-label="$t('dialogs.manageTransaction.form.discardAction')"
    confirm-variant="destructive"
    @confirm="editing = false"
  >
    <template #title>{{ $t('dialogs.manageTransaction.form.discardTitle') }}</template>
    <template #description>{{ $t('dialogs.manageTransaction.form.discardDetails') }}</template>
  </ResponsiveAlertDialog>
</template>
