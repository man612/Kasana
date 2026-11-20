<script setup lang="ts">
import { cn } from '@/lib/utils';
import { computed } from 'vue';
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
const delegatedProps = computed(() => {
  const { class: _class, onBackdropClick: _backdropClick, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay
      @click.stop.prevent="props.onBackdropClick?.()"
      :class="[
        'fixed inset-0 z-(--z-over-dialog) bg-black/65 backdrop-blur-[2px] duration-200 ease-out motion-reduce:animate-none!',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      ]"
    />
    <!-- Keep the center and hit targets stationary while opening. Scaling a
         destructive confirmation can make Cancel/Confirm move beneath an
         arriving pointer at narrow widths with 200% text magnification. -->
    <AlertDialogContent
      v-bind="{ ...delegatedProps, ...emitsAsProps }"
      :class="
        cn(
          'lajur-confirmation-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-[50%] left-[50%] isolate z-(--z-over-dialog) grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] grid-cols-1 gap-4 rounded-2xl p-6 duration-200 ease-out motion-reduce:animate-none! md:w-full',
          props.class,
        )
      "
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>

<style scoped>
/* Animate the surface behind the buttons so the touch targets stay stationary. */
.lajur-confirmation-surface::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  border: 1px solid var(--border);
  border-radius: inherit;
  background: var(--dialog);
  box-shadow: 0 16px 48px rgb(0 0 0 / 24%);
  content: '';
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .lajur-confirmation-surface[data-state='open']::before {
    animation: confirmation-surface 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .lajur-confirmation-surface[data-state='closed']::before {
    animation: confirmation-surface 200ms ease-in reverse both;
  }
}

@keyframes confirmation-surface {
  from {
    transform: translateY(4px) scale(0.98);
  }

  to {
    transform: none;
  }
}
</style>
