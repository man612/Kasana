<script setup lang="ts">
import { cn } from '@/lib/utils';
import {
  AlertDialogContent,
  type AlertDialogContentEmits,
  type AlertDialogContentProps,
  AlertDialogOverlay,
  AlertDialogPortal,
  useEmitAsProps,
} from 'reka-ui';

const props = defineProps<
  AlertDialogContentProps & {
    class?: string;
    onBackdropClick?: () => void;
  }
>();
const emits = defineEmits<AlertDialogContentEmits>();

const emitsAsProps = useEmitAsProps(emits);
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay
      @click.stop.prevent="props.onBackdropClick?.()"
      :class="[
        'bg-background/80 fixed inset-0 z-(--z-over-dialog) backdrop-blur-xs duration-200 motion-reduce:animate-none!',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      ]"
    />
    <!-- Keep the center and hit targets stationary while opening. Scaling a
         destructive confirmation can make Cancel/Confirm move beneath an
         arriving pointer at narrow widths with 200% text magnification. -->
    <AlertDialogContent
      v-bind="{ ...props, ...emitsAsProps }"
      :class="
        cn(
          'border-border bg-dialog data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-[50%] left-[50%] z-(--z-over-dialog) grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] grid-cols-1 gap-4 rounded-2xl border p-6 shadow-lg duration-200 motion-reduce:animate-none! md:w-full',
          props.class,
        )
      "
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>
