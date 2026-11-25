<script lang="ts" setup>
import OverlayLayer from '@/components/common/overlay-layer.vue';
import { useDescribedByAttrs } from '@/components/lib/ui/dialog/described-by';
import { vAnimateDialogHeight } from '@/composable/animate-dialog-height';
import { useKeyboardViewport } from '@/composable/use-keyboard-viewport';
import { cn } from '@/lib/utils';
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import { injectDialogRootContext, useForwardPropsEmits } from 'reka-ui';
import { DrawerContent, DrawerPortal } from 'vaul-vue';
import { type HtmlHTMLAttributes, computed, nextTick } from 'vue';

import DrawerIndicator from './DrawerIndicator.vue';
import DrawerOverlay from './DrawerOverlay.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<
  DialogContentProps & {
    class?: HtmlHTMLAttributes['class'];
    customIndicator?: boolean;
    dimBackdrop?: boolean;
    appBlocking?: boolean;
    adaptiveHeight?: boolean;
    intrinsicHeightMotion?: boolean;
  }
>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    class: _,
    customIndicator: _customIndicator,
    dimBackdrop: _dimBackdrop,
    appBlocking: _appBlocking,
    adaptiveHeight: _adaptiveHeight,
    intrinsicHeightMotion: _intrinsicHeightMotion,
    ...delegated
  } = props;

  return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const keyboard = useKeyboardViewport(computed(() => Boolean(props.adaptiveHeight)));
const sheetStyle = computed(() =>
  props.adaptiveHeight && keyboard.value
    ? { bottom: `${keyboard.value.bottomInset}px`, maxHeight: `calc(${keyboard.value.height}px - 1rem)` }
    : undefined,
);
const describedByAttrs = useDescribedByAttrs();
const dialog = injectDialogRootContext();

// Focus the frame when Vaul suppresses autofocus to avoid summoning the keyboard.
const focusDrawer = async () => {
  const previousFocus = document.activeElement;
  await nextTick();
  const surface = dialog.contentElement.value;
  if (dialog.open.value && surface && document.activeElement === previousFocus && !surface.contains(previousFocus)) {
    surface.focus({ preventScroll: true });
  }
};
</script>

<template>
  <DrawerPortal>
    <OverlayLayer :open="dialog.open.value" :app-blocking="appBlocking">
      <DrawerOverlay :class="dimBackdrop && 'lajur-scrim-blur z-(--z-over-dialog)'" />
      <DrawerContent
        :inert="!dialog.open.value"
        :aria-modal="dialog.modal.value || undefined"
        @open-auto-focus="focusDrawer"
        v-animate-dialog-height="Boolean(adaptiveHeight && !intrinsicHeightMotion)"
        v-bind="{ ...forwarded, ...describedByAttrs, ...$attrs }"
        :style="sheetStyle"
        :data-keyboard-resize="keyboard ? '' : undefined"
        :class="
          cn(
            'bg-dialog fixed inset-x-0 bottom-0 z-(--z-dialog) mt-24 flex h-auto max-h-[95vh] flex-col rounded-t-[10px] border pb-[env(safe-area-inset-bottom)] motion-reduce:animate-none!',
            adaptiveHeight && 'max-h-[calc(100dvh-2rem-env(safe-area-inset-top))]',
            dimBackdrop && 'z-(--z-over-dialog)',
            props.class,
          )
        "
      >
        <template v-if="!customIndicator">
          <DrawerIndicator />
        </template>

        <slot />
      </DrawerContent>
    </OverlayLayer>
  </DrawerPortal>
</template>
