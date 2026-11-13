<script lang="ts" setup>
import DocsLink from '@/components/common/docs-link.vue';
import * as Drawer from '@/components/lib/ui/drawer';
import * as Dialog from '@/components/lib/ui/dialog';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { InfoIcon } from '@lucide/vue';
import { createReusableTemplate } from '@vueuse/core';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

const [UseTriggerTemplate, TriggerContent] = createReusableTemplate();
const [UseBodyTemplate, BodyContent] = createReusableTemplate();
</script>

<template>
  <UseTriggerTemplate>
    <span class="text-primary-text inline-flex cursor-pointer items-center gap-1 hover:underline">
      {{ t('dialogs.manageTransaction.refundInfo.trigger') }} <InfoIcon :size="16" />
    </span>
  </UseTriggerTemplate>

  <UseBodyTemplate>
    <h4 class="mt-3 mb-1 font-semibold">{{ t('dialogs.manageTransaction.refundInfo.howItWorks.title') }}</h4>
    <ul class="text-muted-foreground list-disc pl-5 text-sm">
      <li>{{ t('dialogs.manageTransaction.refundInfo.howItWorks.expenseRefund') }}</li>
      <li>{{ t('dialogs.manageTransaction.refundInfo.howItWorks.incomeRefund') }}</li>
      <li>{{ t('dialogs.manageTransaction.refundInfo.howItWorks.noOriginal') }}</li>
    </ul>

    <h4 class="mt-3 mb-1 font-semibold">{{ t('dialogs.manageTransaction.refundInfo.benefits.title') }}</h4>
    <ul class="text-muted-foreground list-disc pl-5 text-sm">
      <li>{{ t('dialogs.manageTransaction.refundInfo.benefits.accuracy') }}</li>
      <li>{{ t('dialogs.manageTransaction.refundInfo.benefits.tracking') }}</li>
    </ul>

    <h4 class="mt-3 mb-1 font-semibold">{{ t('dialogs.manageTransaction.refundInfo.notes.title') }}</h4>
    <ul class="text-muted-foreground list-disc pl-5 text-sm">
      <li>{{ t('dialogs.manageTransaction.refundInfo.notes.recordKeeping') }}</li>
      <li>{{ t('dialogs.manageTransaction.refundInfo.notes.noBalanceAdjust') }}</li>
      <li>{{ t('dialogs.manageTransaction.refundInfo.notes.canUnlink') }}</li>
    </ul>

    <h4 class="mt-3 mb-1 font-semibold">{{ t('dialogs.manageTransaction.refundInfo.examples.title') }}</h4>
    <ul class="text-muted-foreground list-disc pl-5 text-sm">
      <li>{{ t('dialogs.manageTransaction.refundInfo.examples.customerPayment') }}</li>
      <li>{{ t('dialogs.manageTransaction.refundInfo.examples.vendorRefund') }}</li>
      <li>{{ t('dialogs.manageTransaction.refundInfo.examples.noOriginalTx') }}</li>
    </ul>

    <div class="border-border mt-4 border-t pt-3 text-sm">
      <DocsLink path="/transfers-and-refunds/refunds/" />
    </div>
  </UseBodyTemplate>

  <Drawer.Drawer v-if="isMobile">
    <Drawer.DrawerTrigger as-child>
      <TriggerContent />
    </Drawer.DrawerTrigger>
    <Drawer.DrawerContent class="max-h-[85dvh]">
      <div class="min-h-0 overflow-y-auto px-4 pt-4 pb-6">
        <Drawer.DrawerTitle>{{ t('dialogs.manageTransaction.refundInfo.title') }}</Drawer.DrawerTitle>
        <Drawer.DrawerDescription class="mt-2">
          {{ t('dialogs.manageTransaction.refundInfo.description') }}
        </Drawer.DrawerDescription>
        <BodyContent />
      </div>
    </Drawer.DrawerContent>
  </Drawer.Drawer>

  <Dialog.Dialog v-else>
    <Dialog.DialogTrigger as-child><TriggerContent /></Dialog.DialogTrigger>
    <Dialog.DialogContent blur-overlay class="w-[calc(100vw-2rem)] max-w-lg gap-2 overflow-hidden p-5">
      <Dialog.DialogTitle class="pr-12 text-base font-semibold">
        {{ t('dialogs.manageTransaction.refundInfo.title') }}
      </Dialog.DialogTitle>
      <Dialog.DialogDescription class="text-muted-foreground pr-10 text-xs leading-relaxed">
        {{ t('dialogs.manageTransaction.refundInfo.description') }}
      </Dialog.DialogDescription>
      <div class="mt-2 max-h-[min(66dvh,480px)] overflow-y-auto overscroll-contain pr-3">
        <BodyContent />
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
