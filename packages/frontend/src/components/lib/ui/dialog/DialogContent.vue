<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { useDescribedByAttrs } from '@/components/lib/ui/dialog/described-by';
import { vAnimateDialogHeight } from '@/composable/animate-dialog-height';
import { useKeyboardViewport } from '@/composable/use-keyboard-viewport';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { cn } from '@/lib/utils';
import { X } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import {
  DialogClose,
  DialogContent,
  type DialogContentEmits,
  type DialogContentProps,
  DialogOverlay,
  DialogPortal,
  injectDialogRootContext,
  useForwardPropsEmits,
} from 'reka-ui';
import { type HTMLAttributes, computed } from 'vue';

// Fallthrough attributes belong to the actual dialog element, not its Portal.
defineOptions({ inheritAttrs: false });

const { t } = useI18n();

const props = defineProps<
  DialogContentProps & {
    class?: HTMLAttributes['class'];
    customClose?: boolean;
    /** Softly blur the content behind the overlay. */
    blurOverlay?: boolean;
    raised?: boolean;
    /** Child layout transitions already drive the content's intrinsic height. */
    intrinsicHeightMotion?: boolean;
  }
>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    class: _,
    customClose: _customClose,
    blurOverlay: _blurOverlay,
    raised: _raised,
    intrinsicHeightMotion: _intrinsicHeightMotion,
    ...delegated
  } = props;

  return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const describedByAttrs = useDescribedByAttrs();

const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
const { open } = injectDialogRootContext();
const keyboard = useKeyboardViewport(computed(() => isMobile.value && open.value));
const keyboardViewportStyle = computed(() => {
  const bounds = keyboard.value;
  if (!bounds) return undefined;
  return { top: `${bounds.top + bounds.height / 2}px`, maxHeight: `${Math.max(1, bounds.height - 24)}px` };
});
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      :class="[
        'lajur-scrim-dialog fixed inset-0 duration-200 motion-reduce:animate-none!',
        props.raised ? 'z-[calc(var(--z-over-dialog)_+_1)]' : 'z-(--z-dialog)',
        props.blurOverlay && 'lajur-scrim-blur',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      ]"
    />
    <DialogContent
      v-animate-dialog-height="!intrinsicHeightMotion"
      :style="keyboardViewportStyle"
      :data-keyboard-resize="keyboard ? '' : undefined"
      v-bind="{ ...forwarded, ...describedByAttrs, ...$attrs }"
      :class="
        cn(
          'bg-dialog fixed top-1/2 left-1/2 z-(--z-dialog) flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border p-6 shadow-lg duration-200 sm:rounded-lg',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none!',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          props.raised && 'z-[calc(var(--z-over-dialog)_+_1)]',
          props.class,
        )
      "
    >
      <slot />

      <template v-if="!customClose">
        <DialogClose class="absolute top-3.5 right-3.5 z-20" as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-10 shrink-0 rounded-md md:size-8"
            :aria-label="t('common.ui.close')"
          >
            <X class="size-4" />
            <span class="sr-only">{{ t('common.ui.close') }}</span>
          </Button>
        </DialogClose>
      </template>
    </DialogContent>
  </DialogPortal>
</template>
