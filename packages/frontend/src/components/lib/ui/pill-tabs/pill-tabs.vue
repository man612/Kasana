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
const EDGE_FADE = 8;
const EDGE_PADDING = 6;
const activeTab = ref<{ left: number; width: number }>();
const maskImage = ref('none');
const isIndicatorPositioned = ref(false);
const readViewportLeft = ({ track }: { track: HTMLElement }) =>
  track.matches(':dir(rtl)')
    ? Math.max(0, track.scrollWidth - track.clientWidth + track.scrollLeft)
    : Math.max(0, track.scrollLeft);

const updateFades = () => {
  const el = containerRef.value;
  if (!el || !props.scrollable) return;
  const viewport = el.clientWidth;
  const content = el.scrollWidth;
  const left = readViewportLeft({ track: el });
  const right = left + viewport;
  const tab = activeTab.value;
  const tabIsVisible = tab && tab.left + tab.width > left && tab.left < right;
  const start = left > 1 ? Math.min(EDGE_FADE, tabIsVisible ? Math.max(0, tab.left - left) : EDGE_FADE) : 0;
  const end =
    content - right > 1 ? Math.min(EDGE_FADE, tabIsVisible ? Math.max(0, right - tab.left - tab.width) : EDGE_FADE) : 0;
  maskImage.value =
    start || end
      ? `linear-gradient(to right, ${start ? 'transparent' : 'black'}, black ${start}px, black calc(100% - ${end}px), ${end ? 'transparent' : 'black'})`
      : 'none';
};
const indicatorStyle = ref({ left: '0px', width: '0px' });

function updateIndicator(reveal = false) {
  const el = containerRef.value;
  if (!el) return;
  const activeBtn = triggerRefs.value?.find((button) => button.dataset.value === props.modelValue);
  if (!activeBtn) {
    indicatorStyle.value = { left: '0px', width: '0px' };
    activeTab.value = undefined;
    isIndicatorPositioned.value = false;
    updateFades();
    return;
  }

  const initial = !isIndicatorPositioned.value;
  if (initial)
    requestAnimationFrame(() => {
      isIndicatorPositioned.value = true;
    });
  activeTab.value = { left: activeBtn.offsetLeft, width: activeBtn.offsetWidth };
  updateFades();
  indicatorStyle.value = {
    left: `${activeBtn.offsetLeft}px`,
    width: `${activeBtn.offsetWidth}px`,
  };
  if (reveal && props.scrollable) {
    const left = readViewportLeft({ track: el });
    const leftOverflow = activeBtn.offsetLeft - left - EDGE_PADDING;
    const rightOverflow = activeBtn.offsetLeft + activeBtn.offsetWidth - left - el.clientWidth + EDGE_PADDING;
    const delta = leftOverflow < 0 ? leftOverflow : Math.max(0, rightOverflow);
    if (Math.abs(delta) > 0.5) {
      el.scrollBy({ left: delta, behavior: initial || reducedMotion.value === 'reduce' ? 'instant' : 'smooth' });
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
  <div :class="scrollable ? 'bg-muted border-border/50 min-w-0 rounded-full border' : 'contents'">
    <div
      ref="containerRef"
      v-bind="$attrs"
      :style="scrollable ? { maskImage } : undefined"
      :data-no-nav-swipe="scrollable ? '' : undefined"
      :class="
        cn(
          pillTabsContainerVariants({ size }),
          fullWidth && 'flex w-full self-auto',
          scrollable && 'flex w-full overscroll-x-contain rounded-full border-0 bg-transparent px-2',
        )
      "
      @scroll.passive="updateFades"
    >
      <!-- Sliding indicator -->
      <div
        aria-hidden="true"
        :class="
          cn(
            pillTabsIndicatorVariants({ size }),
            scrollable && 'bg-primary! rounded-full',
            !isIndicatorPositioned && 'opacity-0 transition-none!',
          )
        "
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
  </div>
</template>
