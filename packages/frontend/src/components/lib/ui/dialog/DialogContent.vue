<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { useDescribedByAttrs } from '@/components/lib/ui/dialog/described-by';
import { vAnimateDialogHeight } from '@/composable/animate-dialog-height';
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
  useForwardPropsEmits,
} from 'reka-ui';
import { type HTMLAttributes, computed, onMounted, onUnmounted, ref } from 'vue';

// Fallthrough attributes belong to the actual dialog element, not its Portal.
defineOptions({ inheritAttrs: false });

const { t } = useI18n();

const props = defineProps<
  DialogContentProps & {
    class?: HTMLAttributes['class'];
    customClose?: boolean;
    /** Only calendar dialogs use a softly blurred backdrop. */
    blurOverlay?: boolean;
  }
>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { class: _, customClose: _customClose, blurOverlay: _blurOverlay, ...delegated } = props;

  return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const describedByAttrs = useDescribedByAttrs();

// On mobile the keyboard shrinks the visual viewport, not the layout viewport.
const keyboardViewportStyle = ref<{ top: string; maxHeight: string }>();
const updateVisualViewport = () => {
  const viewport = window.visualViewport;
  if (!viewport || window.innerWidth > 767 || viewport.height >= window.innerHeight - 100) {
    keyboardViewportStyle.value = undefined;
    return;
  }
  keyboardViewportStyle.value = {
    top: `${viewport.offsetTop + viewport.height / 2}px`,
    maxHeight: `${Math.max(160, viewport.height - 24)}px`,
  };
};
onMounted(() => {
  updateVisualViewport();
  window.visualViewport?.addEventListener('resize', updateVisualViewport);
  window.visualViewport?.addEventListener('scroll', updateVisualViewport);
});
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', updateVisualViewport);
  window.visualViewport?.removeEventListener('scroll', updateVisualViewport);
});
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      :class="[
        'fixed inset-0 z-(--z-dialog) bg-black/80',
        props.blurOverlay && 'backdrop-blur-[3px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      ]"
    />
    <DialogContent
      v-animate-dialog-height
      :style="keyboardViewportStyle"
      v-bind="{ ...forwarded, ...describedByAttrs, ...$attrs }"
      :class="
        cn(
          'bg-dialog fixed top-1/2 left-1/2 z-(--z-dialog) flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border p-6 shadow-lg duration-200 sm:rounded-lg',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          props.class,
        )
      "
    >
      <slot />

      <template v-if="!customClose">
        <DialogClose class="absolute top-3.5 right-3.5 z-20" as-child>
          <Button variant="ghost" size="icon" class="size-10 shrink-0 rounded-md md:size-8" :aria-label="t('common.ui.close')">
            <X class="size-4" />
            <span class="sr-only">{{ t('common.ui.close') }}</span>
          </Button>
        </DialogClose>
      </template>
    </DialogContent>
  </DialogPortal>
</template>
