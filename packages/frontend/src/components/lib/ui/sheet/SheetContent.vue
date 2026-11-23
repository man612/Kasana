<script setup lang="ts">
import Button from '@/components/lib/ui/button/Button.vue';
import { useDescribedByAttrs } from '@/components/lib/ui/dialog/described-by';
import { cn } from '@/lib/utils';
import { XIcon } from '@lucide/vue';
import {
  DialogClose,
  DialogContent,
  type DialogContentEmits,
  type DialogContentProps,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui';
import { type HTMLAttributes, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { type SheetVariants, sheetVariants } from '../sheet';

interface SheetContentProps extends DialogContentProps {
  class?: HTMLAttributes['class'];
  side?: SheetVariants['side'];
  overlayClass?: HTMLAttributes['class'];
  compactClose?: boolean;
}

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<SheetContentProps>();

const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { class: _, side, overlayClass: _overlayClass, compactClose: _compactClose, ...delegated } = props;

  return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const describedByAttrs = useDescribedByAttrs();
const { t } = useI18n();
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      :class="
        cn(
          'lajur-scrim-dialog fixed inset-0 z-(--z-dialog) motion-reduce:animate-none!',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          props.overlayClass,
        )
      "
    />
    <DialogContent
      :class="cn(sheetVariants({ side }), props.class)"
      v-bind="{ ...forwarded, ...describedByAttrs, ...$attrs }"
    >
      <slot />

      <DialogClose
        as-child
        :class="[
          'ring-offset-background absolute top-4 right-4 rounded-sm',
          'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-hidden',
          'disabled:pointer-events-none',
          compactClose &&
            'top-[calc(env(safe-area-inset-top)+0.625rem)] right-[calc(env(safe-area-inset-right)+0.75rem)]',
        ]"
      >
        <Button
          size="icon"
          variant="secondary"
          :class="compactClose && 'lajur-sheet-close size-11 rounded-full'"
          :aria-label="t('common.ui.close')"
        >
          <XIcon
            :class="compactClose ? 'size-4' : 'size-5'"
            :stroke-width="compactClose ? 2.15 : 2"
            aria-hidden="true"
          />
        </Button>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
