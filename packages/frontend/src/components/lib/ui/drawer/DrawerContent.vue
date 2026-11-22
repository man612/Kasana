<script lang="ts" setup>
import { useDescribedByAttrs } from '@/components/lib/ui/dialog/described-by';
import { vAnimateDialogHeight } from '@/composable/animate-dialog-height';
import { useKeyboardViewport } from '@/composable/use-keyboard-viewport';
import { cn } from '@/lib/utils';
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import { useForwardPropsEmits } from 'reka-ui';
import { DrawerContent, DrawerPortal } from 'vaul-vue';
import { type HtmlHTMLAttributes, computed } from 'vue';

import DrawerIndicator from './DrawerIndicator.vue';
import DrawerOverlay from './DrawerOverlay.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<
  DialogContentProps & {
    class?: HtmlHTMLAttributes['class'];
    customIndicator?: boolean;
    dimBackdrop?: boolean;
    adaptiveHeight?: boolean;
  }
>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    class: _,
    customIndicator: _customIndicator,
    dimBackdrop: _dimBackdrop,
    adaptiveHeight: _adaptiveHeight,
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
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay :class="dimBackdrop && 'lajur-scrim-blur z-(--z-over-dialog)'" />
    <DrawerContent
      v-animate-dialog-height="Boolean(adaptiveHeight)"
      v-bind="{ ...forwarded, ...describedByAttrs, ...$attrs }"
      :style="sheetStyle"
      :data-keyboard-resize="keyboard ? '' : undefined"
      :class="
        cn(
          'bg-dialog fixed inset-x-0 bottom-0 z-(--z-dialog) mt-24 flex h-auto max-h-[95vh] flex-col rounded-t-[10px] border pb-[env(safe-area-inset-bottom)]',
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
  </DrawerPortal>
</template>
