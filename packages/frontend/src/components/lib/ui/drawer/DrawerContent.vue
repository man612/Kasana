<script lang="ts" setup>
import { useDescribedByAttrs } from '@/components/lib/ui/dialog/described-by';
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
  }
>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { class: _, customIndicator: _customIndicator, dimBackdrop: _dimBackdrop, ...delegated } = props;

  return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
const describedByAttrs = useDescribedByAttrs();
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay :class="dimBackdrop && 'z-(--z-over-dialog) bg-black/60 backdrop-blur-[2px]'" />
    <DrawerContent
      v-bind="{ ...forwarded, ...describedByAttrs, ...$attrs }"
      :class="
        cn(
          'bg-dialog fixed inset-x-0 bottom-0 z-(--z-dialog) mt-24 flex h-auto max-h-[95vh] flex-col rounded-t-[10px] border pb-[env(safe-area-inset-bottom)]',
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
