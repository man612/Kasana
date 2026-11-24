<script lang="ts" setup>
import { cn } from '@/lib/utils';
import { usePreferredReducedMotion, useResizeObserver } from '@vueuse/core';
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';
import {
  type PillTabItem,
  type PillTabsSize,
  pillTabsContainerVariants,
  pillTabsIndicatorVariants,
  pillTabsTriggerVariants,
} from '.';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    items: PillTabItem[];
    modelValue: string;
    size?: PillTabsSize;
    disabled?: boolean;
    /** Stretch the track to the parent width with equal-width triggers. */
    fullWidth?: boolean;
    scrollable?: boolean;
  }>(),
  { size: 'default', disabled: false, fullWidth: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
const triggerRefs = useTemplateRef<HTMLElement[]>('triggers');
const reducedMotion = usePreferredReducedMotion();
const fades = ref({ start: false, end: false });
const updateFades = () => {
  const el = containerRef.value;
  if (!el || !props.scrollable) return;
  const offset = Math.abs(el.scrollLeft);
  fades.value = { start: offset > 1, end: el.scrollWidth - el.clientWidth - offset > 1 };
};
const indicatorStyle = ref({ left: '0px', width: '0px' });

function updateIndicator(reveal = false) {
  const el = containerRef.value;
  if (!el) return;
  updateFades();
  const activeBtn = triggerRefs.value?.find((button) => button.dataset.value === props.modelValue);
  if (!activeBtn) {
    indicatorStyle.value = { left: '0px', width: '0px' };
    return;
  }

  indicatorStyle.value = {
    left: `${activeBtn.offsetLeft}px`,
    width: `${activeBtn.offsetWidth}px`,
  };
  if (reveal && props.scrollable) {
    const trackBounds = el.getBoundingClientRect();
    const activeBounds = activeBtn.getBoundingClientRect();
    const leftOverflow = activeBounds.left - trackBounds.left;
    const rightOverflow = activeBounds.right - trackBounds.right;
    const delta = leftOverflow < 0 ? leftOverflow : Math.max(0, rightOverflow);
    if (Math.abs(delta) > 0.5) {
      el.scrollBy({ left: delta, behavior: reducedMotion.value === 'reduce' ? 'instant' : 'smooth' });
    }
  }
}

onMounted(() => {
  updateIndicator(true);
});

// Tab labels can resize independently of the scrollport, e.g. when a font loads.
const observedElements = computed(() => [containerRef.value, ...(triggerRefs.value ?? [])]);
useResizeObserver(observedElements, () => updateIndicator(true));

watch(
  () => [props.modelValue, props.items],
  () => nextTick(() => updateIndicator(true)),
);
</script>

<template>
  <div
    :class="
      scrollable
        ? 'bg-muted border-border/50 grid w-full min-w-0 grid-cols-[0.5rem_minmax(0,1fr)_0.5rem] rounded-full border'
        : 'contents'
    "
  >
    <span
      v-if="scrollable"
      aria-hidden="true"
      class="from-muted-foreground/35 pointer-events-none rounded-s-full bg-linear-to-r transition-opacity motion-reduce:transition-none rtl:bg-linear-to-l"
      :class="fades.start ? 'opacity-100' : 'opacity-0'"
    />
    <div
      ref="containerRef"
      v-bind="$attrs"
      :data-no-nav-swipe="scrollable ? '' : undefined"
      :class="
        cn(
          pillTabsContainerVariants({ size }),
          fullWidth && 'flex w-full self-auto',
          scrollable && 'flex w-full overscroll-x-contain rounded-none border-0 bg-transparent',
        )
      "
      @scroll.passive="updateFades"
    >
      <!-- Sliding indicator -->
      <div
        aria-hidden="true"
        :class="cn(pillTabsIndicatorVariants({ size }), scrollable && 'bg-primary! rounded-full')"
        :style="indicatorStyle"
      />
      <!-- Buttons -->
      <button
        v-for="item in items"
        :key="item.value"
        ref="triggers"
        type="button"
        :data-value="item.value"
        :aria-pressed="modelValue === item.value"
        :disabled="disabled || item.disabled"
        :class="
          cn(
            pillTabsTriggerVariants({ size }),
            modelValue === item.value
              ? scrollable
                ? 'text-primary-foreground'
                : 'text-foreground'
              : 'text-muted-foreground',
            scrollable && 'shrink-0 rounded-full duration-200 ease-out motion-reduce:transition-none',
            scrollable && (size === 'sm' ? 'min-h-8 px-2.5' : 'min-h-11'),
            (disabled || item.disabled) && 'cursor-not-allowed opacity-50',
            fullWidth && 'flex-1',
          )
        "
        @click="emit('update:modelValue', item.value)"
      >
        <component :is="item.icon" v-if="item.icon" :class="cn('mr-1.5 inline size-4 align-[-3px]', item.iconClass)" />
        <span :class="item.labelClass">{{ item.label }}</span>
        <span
          v-if="item.count !== undefined"
          class="bg-foreground/10 text-muted-foreground ml-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 align-[1px] text-xs font-semibold tabular-nums"
        >
          {{ item.count }}
        </span>
      </button>
    </div>
    <span
      v-if="scrollable"
      aria-hidden="true"
      class="from-muted-foreground/35 pointer-events-none rounded-e-full bg-linear-to-l transition-opacity motion-reduce:transition-none rtl:bg-linear-to-r"
      :class="fades.end ? 'opacity-100' : 'opacity-0'"
    />
  </div>
</template>
