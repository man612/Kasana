<script lang="ts" setup>
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import type { TransactionDialogSession } from '@/components/dialogs/manage-transaction/composables/transaction-dialog-close';
import { loadTransactionById } from '@/api/transactions';
import { ensureChunkLoaded } from '@/i18n';
import { captureException } from '@/lib/sentry';
import type { AccountModel, TransactionModel } from '@bt/shared/types';
import { createReusableTemplate } from '@vueuse/core';
import { useRoute } from 'vue-router';
import { computed, defineAsyncComponent, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue';
import * as Dialog from '@/components/lib/ui/dialog';
import * as Drawer from '@/components/lib/ui/drawer';

import TransactionReadView from './transaction-read-view.vue';

const loadLoanPaymentForm = async () => {
  const [component] = await Promise.all([
    import('@/pages/loans/components/loan-payment-dialog/loan-payment-form.vue'),
    ensureChunkLoaded('pages/loans'),
  ]);
  return component;
};
const LoanPaymentForm = defineAsyncComponent(loadLoanPaymentForm);

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
  creation?: boolean;
  session: TransactionDialogSession | null;
  transaction?: TransactionModel;
  oppositeTransaction?: TransactionModel;
  loanAccount?: AccountModel;
}>();
const confirmOpen = ref(false);
const hasChanges = () => (loanSession.value ?? props.session)?.hasUnsavedChanges() === true;
const isSaving = () => refreshingCommit.value || (loanSession.value ?? props.session)?.isSaving() === true;
const route = useRoute();
const editing = ref(false);
const showEditor = computed(() => props.creation || editing.value);
const preparingEditor = ref(false);
const refreshingCommit = ref(false);
const body = ref<HTMLElement | null>(null);
let bodyMotion: Animation | undefined;
onScopeDispose(() => bodyMotion?.cancel());
let detailLoad: Promise<void> | undefined;
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

const changeMode = async ({ edit }: { edit: boolean }) => {
  const element = body.value;
  const from = element?.offsetHeight ?? 0;
  bodyMotion?.cancel();
  editing.value = edit;
  await nextTick();
  if (!element?.isConnected || !open.value || editing.value !== edit || !element.animate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const to = element.offsetHeight;
  if (Math.abs(to - from) < 2) return;

  // The mode owns one height transition. Child field transitions can continue
  // to drive intrinsic height once the edit screen is in place.
  const motion = getComputedStyle(element);
  const animation = element.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration: Number.parseFloat(motion.getPropertyValue('--kasana-motion-normal')),
    easing: motion.getPropertyValue('--kasana-motion-ease').trim(),
  });
  bodyMotion = animation;
  void animation.finished
    .catch(() => undefined)
    .then(() => {
      if (bodyMotion === animation) bodyMotion = undefined;
    });
};

const returnToRead = () => {
  if (props.creation) close();
  else void changeMode({ edit: false });
};

const requestOpen = (value: boolean) => {
  if (value) {
    open.value = true;
    return;
  }
  if (!open.value || isSaving()) return;
  if (!showEditor.value) close();
  else if (hasChanges()) confirmOpen.value = true;
  else returnToRead();
};
const requestDismiss = (event: Event) => {
  if (!showEditor.value && !isSaving()) return;
  event.preventDefault();
  requestOpen(false);
};
const refreshDetail = async ({ afterCommit = false }: { afterCommit?: boolean } = {}) => {
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
    if (updated) {
      fresh.value = {
        ...current,
        ...updated,
        hasAttachments: updated.hasAttachments ?? (afterCommit ? undefined : current.hasAttachments),
      };
    }
    if (other) freshOpposite.value = other;
  } catch (error) {
    captureException({ error, context: { source: 'transaction-read-view', transactionId: current.id } });
  }
};
const startEditing = async () => {
  if (preparingEditor.value || !selected.value) return;
  const version = requestVersion;
  preparingEditor.value = true;
  try {
    await Promise.all([
      detailLoad,
      props.loanAccount ? loadLoanPaymentForm() : import('@/components/dialogs/manage-transaction/dialog-content.vue'),
    ]);
    if (open.value && requestVersion === version) await changeMode({ edit: true });
  } catch (error) {
    captureException({ error, context: { source: 'transaction-editor', transactionId: selected.value?.id } });
  } finally {
    if (requestVersion === version) preparingEditor.value = false;
  }
};
const onCommit = () => {
  committed = true;
  emit('committed');
};
const finishEditing = async () => {
  if (!open.value) return;
  if (props.creation || (!committed && props.loanAccount)) {
    close();
    return;
  }
  if (!committed) {
    returnToRead();
    return;
  }
  committed = false;
  refreshingCommit.value = true;
  const refresh = refreshDetail({ afterCommit: true });
  const version = requestVersion;
  await refresh;
  if (requestVersion !== version || !open.value) return;
  refreshingCommit.value = false;
  await changeMode({ edit: false });
};
watch(
  () => [open.value, props.transaction?.id] as const,
  ([visible], [wasVisible]) => {
    requestVersion += 1;
    confirmOpen.value = false;
    preparingEditor.value = false;
    refreshingCommit.value = false;
    if (!visible) return;
    if (!wasVisible) opener.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    committed = false;
    editing.value = false;
    fresh.value = undefined;
    freshOpposite.value = undefined;
    detailLoad = refreshDetail();
  },
);
watch(() => route.fullPath, close);
const focusView = (element: Element) => {
  (
    element.querySelector<HTMLElement>('[data-transaction-heading]') ??
    (element instanceof HTMLElement && element.matches('[data-transaction-heading]') ? element : null)
  )?.focus({ preventScroll: true });
};
const setLeaving = (element: Element) => {
  if (element instanceof HTMLElement) element.inert = true;
};
const setEntering = (element: Element) => {
  if (element instanceof HTMLElement) element.inert = false;
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
    <div
      ref="body"
      class="relative grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden"
    >
      <Transition
        :name="showEditor ? 'lajur-detail-edit' : 'lajur-detail-read'"
        @before-leave="setLeaving"
        @before-enter="setEntering"
        @after-enter="focusView"
      >
        <TransactionReadView
          v-if="selected && !showEditor"
          key="read"
          :transaction="selected"
          :opposite-transaction="opposite"
          :editable="selected.canEdit !== false"
          :preparing-editor="preparingEditor"
          :loan-account="loanAccount"
          @edit="startEditing"
          @close="close"
        />
        <div
          v-else-if="showEditor"
          key="edit"
          class="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden"
          :inert="refreshingCommit"
          :aria-busy="refreshingCommit"
        >
          <LoanPaymentForm
            v-if="loanAccount"
            ref="loanSession"
            back-to-detail
            :loan-account="loanAccount"
            :transaction="selected"
            :opposite-transaction="opposite"
            @committed="onCommit"
            @request-close="requestOpen(false)"
            @close-modal="finishEditing"
          />
          <slot
            v-else
            :request-close="() => requestOpen(false)"
            :transaction="selected"
            :opposite-transaction="opposite"
            :committed="onCommit"
            :finish="finishEditing"
            :deleted="close"
          />
        </div>
      </Transition>
    </div>
  </DefineBody>
  <Drawer.Drawer v-if="mobile" :dismissible="!showEditor" :open="open" @update:open="requestOpen">
    <Drawer.DrawerContent
      adaptive-height
      intrinsic-height-motion
      custom-indicator
      class="max-w-full min-w-0 overflow-hidden"
      @pointer-down-outside="requestDismiss"
      @escape-key-down="requestDismiss"
      @close-auto-focus="restoreFocus"
    >
      <Drawer.DrawerTitle v-if="!showEditor" class="sr-only">{{
        $t('transactions.list.detailsTitle')
      }}</Drawer.DrawerTitle>
      <Drawer.DrawerDescription class="sr-only">{{
        $t('transactions.list.detailsDescription')
      }}</Drawer.DrawerDescription>
      <UseBody />
    </Drawer.DrawerContent>
  </Drawer.Drawer>

  <Dialog.Dialog v-else :open="open" @update:open="requestOpen">
    <Dialog.DialogContent
      custom-close
      intrinsic-height-motion
      @pointer-down-outside="requestDismiss"
      @escape-key-down="requestDismiss"
      @close-auto-focus="restoreFocus"
      :class="[
        'max-h-[90dvh] w-full min-w-0 overflow-hidden p-0 motion-safe:transition-[max-width] motion-safe:duration-(--kasana-motion-normal)',
        !showEditor || isCompact ? 'max-w-lg' : 'max-w-225',
      ]"
    >
      <Dialog.DialogTitle v-if="!showEditor" class="sr-only">{{
        $t('transactions.list.detailsTitle')
      }}</Dialog.DialogTitle>
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
    @confirm="returnToRead"
  >
    <template #title>{{ $t('dialogs.manageTransaction.form.discardTitle') }}</template>
    <template #description>{{ $t('dialogs.manageTransaction.form.discardDetails') }}</template>
  </ResponsiveAlertDialog>
</template>
