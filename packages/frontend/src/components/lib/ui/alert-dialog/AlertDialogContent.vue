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
      class="lajur-confirmation-backdrop lajur-scrim-dialog lajur-scrim-blur fixed inset-0 z-(--z-over-dialog)"
    />
    <AlertDialogContent
      v-bind="{ ...delegatedProps, ...emitsAsProps }"
      :class="
        cn(
          'lajur-confirmation-surface border-border bg-dialog fixed top-1/2 left-1/2 z-(--z-over-dialog) grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 grid-cols-1 gap-4 rounded-2xl border p-6 shadow-xl md:w-full',
          props.class,
        )
      "
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .lajur-confirmation-surface[data-state='open'] {
    animation: confirmation-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .lajur-confirmation-surface[data-state='closed'] {
    pointer-events: none;
    animation: confirmation-exit 190ms cubic-bezier(0.4, 0, 0.7, 0.2) both;
  }

  .lajur-confirmation-backdrop[data-state='open'] {
    animation: confirmation-dim 220ms ease-out both;
  }

  .lajur-confirmation-backdrop[data-state='closed'] {
    animation: confirmation-clear 190ms ease-in both;
  }
}

@keyframes confirmation-enter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.975);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes confirmation-exit {
  to {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
}

@keyframes confirmation-dim {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes confirmation-clear {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
