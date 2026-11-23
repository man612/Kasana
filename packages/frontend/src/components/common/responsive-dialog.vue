<script lang="ts" setup>
import DialogHeaderActions from '@/components/common/dialog-header-actions.vue';
import * as Dialog from '@/components/lib/ui/dialog';
import { Button } from '@/components/lib/ui/button';
import { XIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import * as Drawer from '@/components/lib/ui/drawer';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { useCloseDialogWhen } from '@/composable/use-close-dialog-when';
import { useKeyboardViewport } from '@/composable/use-keyboard-viewport';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { createReusableTemplate, useVModel } from '@vueuse/core';
import { computed, useSlots, type HTMLAttributes } from 'vue';

const { t } = useI18n();
const slots = useSlots();
const [UseTemplate, SlotContent] = createReusableTemplate();
const [UseFooterTemplate, FooterSlotContent] = createReusableTemplate();
const [UseScrollArea, ScrollAreaContent] = createReusableTemplate();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

const props = withDefaults(
  defineProps<{
    open?: boolean;
    /** Short mobile explanations appear centered instead of as a tall sheet. */
    mobilePresentation?: 'drawer' | 'center';
    dialogContentClass?: HTMLAttributes['class'];
    drawerContentClass?: HTMLAttributes['class'];
    customClose?: boolean;
    centeredTitle?: boolean;
    fitKeyboard?: boolean;
    intrinsicHeightMotion?: boolean;
    raised?: boolean;
    /** Closes the dialog the moment this turns true, e.g. `useIsAiUsageExitPage()` for dialogs linking to AI or billing settings. */
    closeWhen?: boolean;
    /** When true, disables the internal scroll wrapper (display: contents).
     * Use when the dialog content manages its own scrolling layout. */
    noInternalScroll?: boolean;
    /** When true, the footer slot is not rendered in drawer (mobile) mode.
     * Use when the footer only contains a close action — swipe-to-close is enough on mobile. */
    hideDrawerFooter?: boolean;
    /** Use an X for an action-only footer that has no dismissal button. */
    showCloseWithFooter?: boolean;
    /** When true, the drawer (mobile) skips the grey grab-handle indicator.
     * Use when the content paints its own flush element at the top edge. */
    drawerCustomIndicator?: boolean;
    /** When true, the title/description slots are rendered as visually-hidden (`sr-only`)
     * accessible labels with no surrounding header spacing, instead of a styled visible header.
     * Use when the content owns its own visible heading but Radix still needs a DialogTitle. */
    srOnlyHeader?: boolean;
    /** When false, nothing closes the dialog but the parent flipping `open`: ESC, outside
     * click and drawer swipe are ignored. For app-locking progress that must run to the end. */
    dismissible?: boolean;
  }>(),
  { dismissible: true, mobilePresentation: 'drawer' },
);

const emit = defineEmits(['update:open', 'open-auto-focus', 'close-auto-focus', 'closed']);

const isOpen = useVModel(props, 'open', emit, { passive: true });
const keyboard = useKeyboardViewport(
  computed(() => Boolean(props.fitKeyboard && isOpen.value && isMobile.value && props.mobilePresentation === 'drawer')),
);
const drawerKeyboardStyle = computed(() =>
  isOpen.value && keyboard.value
    ? { bottom: `${keyboard.value.bottomInset}px`, maxHeight: `${Math.max(1, keyboard.value.height - 8)}px` }
    : undefined,
);

const setOpen = (open: boolean) => {
  if (!open && !props.dismissible) return;
  isOpen.value = open;
};

const close = () => setOpen(false);
const canShowClose = computed(() => props.dismissible && !props.customClose);
const hasDialogClose = computed(() => canShowClose.value && (!slots.footer || props.showCloseWithFooter));
const hasDrawerClose = computed(() => hasDialogClose.value || (canShowClose.value && props.hideDrawerFooter));
const onCloseAutoFocus = (event: Event) => {
  emit('close-auto-focus', event);
  if (!isOpen.value) emit('closed');
};

useCloseDialogWhen({ when: () => !!props.closeWhen, close });
</script>

<template>
  <UseTemplate>
    <slot :close="close" />
  </UseTemplate>

  <UseFooterTemplate>
    <slot name="footer" :close="close" />
  </UseFooterTemplate>

  <UseScrollArea>
    <ScrollArea v-if="!props.noInternalScroll" class="-mx-1 min-h-0 flex-1" viewport-class="pl-1 pr-4">
      <SlotContent />
    </ScrollArea>
    <SlotContent v-else />
  </UseScrollArea>

  <template v-if="isMobile && props.mobilePresentation === 'drawer'">
    <Drawer.Drawer :open="isOpen" :fixed="props.fitKeyboard" :dismissible="props.dismissible" @update:open="setOpen">
      <Drawer.DrawerTrigger v-if="$slots.trigger" as-child>
        <slot name="trigger" />
      </Drawer.DrawerTrigger>

      <Drawer.DrawerContent
        :custom-indicator="props.drawerCustomIndicator"
        :dim-backdrop="props.raised"
        :style="drawerKeyboardStyle"
        :class="[
          !props.noInternalScroll && 'grid grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden',
          'px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          drawerContentClass,
        ]"
        @close-auto-focus="onCloseAutoFocus"
        @open-auto-focus="(event: Event) => emit('open-auto-focus', event)"
      >
        <Button
          v-if="hasDrawerClose && !$slots['header-actions']"
          type="button"
          variant="ghost"
          size="icon"
          class="absolute top-3 right-3 z-30 size-10"
          :aria-label="t('common.ui.close')"
          @click="close"
        >
          <XIcon class="size-5" />
        </Button>
        <template v-if="props.srOnlyHeader">
          <Drawer.DrawerTitle class="sr-only">
            <slot name="title" />
          </Drawer.DrawerTitle>
          <Drawer.DrawerDescription class="sr-only">
            <slot name="description" />
          </Drawer.DrawerDescription>
        </template>
        <component
          :is="$slots.title || $slots.description ? Drawer.DrawerHeader : 'div'"
          v-else
          class="mb-2 px-0 pb-0"
          :class="
            $slots['header-actions']
              ? props.centeredTitle
                ? 'grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center pt-2 text-center'
                : 'grid grid-cols-[minmax(0,1fr)_auto] items-start pt-2 text-left'
              : 'pt-6 text-center'
          "
        >
          <span v-if="props.centeredTitle && $slots['header-actions']" aria-hidden="true" />
          <div :class="$slots['header-actions'] ? 'min-w-0' : 'contents'">
            <Drawer.DrawerTitle><slot name="title" /></Drawer.DrawerTitle>
            <Drawer.DrawerDescription v-if="$slots.description"><slot name="description" /></Drawer.DrawerDescription>
          </div>
          <DialogHeaderActions v-if="$slots['header-actions']" :close="hasDrawerClose ? close : undefined">
            <slot name="header-actions" />
          </DialogHeaderActions>
        </component>

        <ScrollAreaContent />

        <Drawer.DrawerFooter
          v-if="$slots.footer && !hideDrawerFooter"
          class="flex-row items-stretch gap-2 px-0 [&>*]:min-w-0 [&>*]:flex-1"
        >
          <FooterSlotContent />
        </Drawer.DrawerFooter>
      </Drawer.DrawerContent>
    </Drawer.Drawer>
  </template>
  <template v-else>
    <Dialog.Dialog :open="isOpen" @update:open="setOpen">
      <Dialog.DialogTrigger v-if="$slots.trigger" as-child>
        <slot name="trigger" />
      </Dialog.DialogTrigger>

      <Dialog.DialogContent
        :intrinsic-height-motion="props.intrinsicHeightMotion"
        :class="[
          !props.noInternalScroll && 'grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden',
          dialogContentClass,
          isMobile && 'max-h-[88dvh] w-[calc(100vw-2rem)] max-w-md rounded-2xl',
        ]"
        :blur-overlay="isMobile || props.raised"
        :custom-close="!hasDialogClose || Boolean($slots['header-actions'])"
        :raised="props.raised"
        @close-auto-focus="onCloseAutoFocus"
        @open-auto-focus="(event: Event) => emit('open-auto-focus', event)"
      >
        <template v-if="props.srOnlyHeader">
          <Dialog.DialogTitle class="sr-only">
            <slot name="title" />
          </Dialog.DialogTitle>
          <Dialog.DialogDescription class="sr-only">
            <slot name="description" />
          </Dialog.DialogDescription>
        </template>
        <template v-else-if="$slots.title || $slots.description">
          <Dialog.DialogHeader
            class="mb-4"
            :class="
              props.centeredTitle
                ? 'grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center text-center'
                : $slots['header-actions'] && 'grid grid-cols-[minmax(0,1fr)_auto] items-start text-left'
            "
          >
            <span v-if="props.centeredTitle" aria-hidden="true" />
            <div :class="$slots['header-actions'] ? 'min-w-0' : 'contents'">
              <Dialog.DialogTitle><slot name="title" /></Dialog.DialogTitle>
              <Dialog.DialogDescription v-if="$slots.description"><slot name="description" /></Dialog.DialogDescription>
            </div>
            <DialogHeaderActions v-if="$slots['header-actions']" :close="hasDialogClose ? close : undefined">
              <slot name="header-actions" />
            </DialogHeaderActions>
          </Dialog.DialogHeader>
        </template>

        <ScrollAreaContent />

        <Dialog.DialogFooter v-if="$slots.footer">
          <FooterSlotContent />
        </Dialog.DialogFooter>
      </Dialog.DialogContent>
    </Dialog.Dialog>
  </template>
</template>
