<script setup lang="ts">
import * as Dialog from '@/components/lib/ui/dialog';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import * as Drawer from '@/components/lib/ui/drawer';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { trackAnalyticsEvent } from '@/lib/posthog';
import { createReusableTemplate, useVModel } from '@vueuse/core';
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ManageTransactionDialogContent from './dialog-content.vue';
import type { TransactionPrefill } from './types';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    prefill?: TransactionPrefill;
  }>(),
  { open: undefined, prefill: undefined },
);

const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const { t } = useI18n();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
const isOpen = useVModel(props, 'open', emit, { passive: true, defaultValue: false });

const isCreateMore = ref(false);
const nextEntryPrefill = shallowRef<TransactionPrefill>();
const contentKey = ref(0);
const contentRef = ref<InstanceType<typeof ManageTransactionDialogContent> | null>(null);
const contentPrefill = computed(() => nextEntryPrefill.value ?? props.prefill);
const isDiscardConfirmationOpen = ref(false);
const hasDirtyForm = () => contentRef.value?.hasUnsavedChanges() === true;
const interceptDismiss = (event: Event) => {
  if (!hasDirtyForm()) return;
  event.preventDefault();
  isDiscardConfirmationOpen.value = true;
};
const requestOpen = (open: boolean) => {
  if (open) {
    isOpen.value = true;
    return;
  }
  if (hasDirtyForm()) {
    isDiscardConfirmationOpen.value = true;
    return;
  }
  isOpen.value = false;
};
const confirmDiscard = () => {
  isDiscardConfirmationOpen.value = false;
  isOpen.value = false;
};
const [DefineContent, ReuseContent] = createReusableTemplate();

watch(isOpen, (open) => {
  isDiscardConfirmationOpen.value = false;
  if (!open) return;
  trackAnalyticsEvent({ event: 'transaction_creation_opened' });
  isCreateMore.value = false;
  nextEntryPrefill.value = undefined;
});

// A fresh content instance drops every one-shot state the previous entry left behind.
const startNextEntry = async ({ prefill }: { prefill: TransactionPrefill }) => {
  if (!isOpen.value) return;
  nextEntryPrefill.value = prefill;
  contentKey.value += 1;
  await nextTick();
  contentRef.value?.focusAmount();
};
</script>

<template>
  <DefineContent>
    <ManageTransactionDialogContent
      :key="contentKey"
      ref="contentRef"
      v-model:create-more="isCreateMore"
      :prefill="contentPrefill"
      @close-modal="isOpen = false"
      @request-close="requestOpen(false)"
      @keep-open="startNextEntry"
    />
  </DefineContent>

  <!-- Desktop: Dialog -->
  <Dialog.Dialog v-if="!isMobile" :open="isOpen" @update:open="requestOpen">
    <Dialog.DialogTrigger as-child>
      <slot />
    </Dialog.DialogTrigger>
    <Dialog.DialogContent
      custom-close
      @pointer-down-outside="interceptDismiss"
      @escape-key-down="interceptDismiss"
      class="max-h-[90dvh] w-full max-w-225 overflow-hidden p-0"
    >
      <Dialog.DialogTitle class="sr-only">{{ t('dialogs.manageTransaction.title') }}</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">
        {{ t('dialogs.manageTransaction.description') }}
      </Dialog.DialogDescription>

      <ReuseContent />
    </Dialog.DialogContent>
  </Dialog.Dialog>

  <!-- Mobile: Drawer -->
  <Drawer.Drawer v-else :dismissible="!hasDirtyForm()" :open="isOpen" @update:open="requestOpen">
    <Drawer.DrawerTrigger class="w-full" as-child>
      <slot />
    </Drawer.DrawerTrigger>
    <Drawer.DrawerContent custom-indicator @pointer-down-outside="interceptDismiss" @escape-key-down="interceptDismiss">
      <ReuseContent />
    </Drawer.DrawerContent>
  </Drawer.Drawer>
  <ResponsiveAlertDialog
    v-model:open="isDiscardConfirmationOpen"
    :confirm-label="t('dialogs.manageTransaction.form.discardAction')"
    confirm-variant="destructive"
    @confirm="confirmDiscard"
  >
    <template #title>{{ t('dialogs.manageTransaction.form.discardTitle') }}</template>
    <template #description>{{ t('dialogs.manageTransaction.form.discardDetails') }}</template>
  </ResponsiveAlertDialog>
</template>
