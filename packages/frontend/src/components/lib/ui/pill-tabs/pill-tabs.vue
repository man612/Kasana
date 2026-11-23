<script lang="ts" setup>
import { cn } from '@/lib/utils';
import { usePreferredReducedMotion, useResizeObserver } from '@vueuse/core';
import { nextTick, onMounted, ref, watch } from 'vue';
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
const reducedMotion = usePreferredReducedMotion();
const fades = ref({ start: false, end: false });
const updateFades = () => {
  const el = containerRef.value;
  if (!el || !props.scrollable) return;
  fades.value = { start: el.scrollLeft > 1, end: el.scrollWidth - el.clientWidth - el.scrollLeft > 1 };
};
const indicatorStyle = ref({ left: '0px', width: '0px' });

function updateIndicator(reveal = false) {
  if (!containerRef.value) return;
  updateFades();
  const activeBtn = [...containerRef.value.querySelectorAll<HTMLElement>('[data-value]')].find(
    (button) => button.dataset.value === props.modelValue,
  );
  if (!activeBtn) {
    indicatorStyle.value = { left: '0px', width: '0px' };
    return;
  }

  indicatorStyle.value = {
    left: `${activeBtn.offsetLeft}px`,
    width: `${activeBtn.offsetWidth}px`,
  };
  if (reveal && props.scrollable) {
    const el = containerRef.value;
    const inset = 8;
    const before = activeBtn.offsetLeft - inset;
    const after = activeBtn.offsetLeft + activeBtn.offsetWidth + inset - el.clientWidth;
    const target = el.scrollLeft > before ? before : Math.max(el.scrollLeft, after);
    if (target !== el.scrollLeft) {
      el.scrollTo({ left: target, behavior: reducedMotion.value === 'reduce' ? 'instant' : 'smooth' });
    }
  }
}

onMounted(() => {
  updateIndicator(true);
});

// Covers mounting inside a hidden panel, where every trigger measures 0 until it is shown.
useResizeObserver(containerRef, () => updateIndicator());

watch(
  () => [props.modelValue, props.items],
  () => nextTick(() => updateIndicator(true)),
);
</script>

<template>
  <div class="relative min-w-0" :class="scrollable ? 'w-full' : 'contents'">
    <div
      ref="containerRef"
      v-bind="$attrs"
      :data-no-nav-swipe="scrollable ? '' : undefined"
      :class="
        cn(
          pillTabsContainerVariants({ size }),
          fullWidth && 'flex w-full self-auto',
          scrollable && 'flex w-full overscroll-x-contain rounded-full',
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
            scrollable && 'min-h-11 shrink-0 rounded-full',
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
    <template v-if="scrollable">
      <span
        aria-hidden="true"
        class="from-muted pointer-events-none absolute inset-y-1 left-1 z-2 w-5 rounded-l-full bg-linear-to-r transition-opacity motion-reduce:transition-none"
        :class="fades.start ? 'opacity-100' : 'opacity-0'"
      />
      <span
        aria-hidden="true"
        class="from-muted pointer-events-none absolute inset-y-1 right-1 z-2 w-5 rounded-r-full bg-linear-to-l transition-opacity motion-reduce:transition-none"
        :class="fades.end ? 'opacity-100' : 'opacity-0'"
      />
    </template>
  </div>
</template>
