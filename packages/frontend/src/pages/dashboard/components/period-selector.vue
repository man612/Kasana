<template>
  <div
    data-no-nav-swipe
    class="@container flex w-full min-w-0 items-center justify-center max-md:touch-pan-y"
    :style="{ '--period-direction': direction }"
    @touchstart.passive="onPeriodTouchStart"
    @touchend="onPeriodTouchEnd"
    @touchcancel="clearPeriodTouch"
  >
    <Button
      size="icon-sm"
      variant="ghost"
      class="size-11 shrink-0"
      :aria-label="$t('dashboard.periodSelector.previousPeriod')"
      @click="selectPrevPeriod"
    >
      <ChevronLeft :size="16" />
    </Button>

    <DateSelector
      v-model="period"
      :presets="quickPresets"
      :earliest-date="earliestDate"
      dialog-on-desktop
      popover-class-name="md:min-w-[600px]"
    >
      <template #trigger="{ triggerText }">
        <Button
          variant="ghost"
          size="sm"
          class="min-h-11 max-w-[calc(100cqi-5.5rem)] min-w-0 justify-center px-0 py-0 leading-tight font-medium"
          :aria-label="triggerText"
        >
          <span
            class="relative block max-w-full min-w-0 overflow-hidden text-center motion-safe:transition-[width] motion-safe:duration-200"
            :style="{ width: labelWidth === undefined ? undefined : labelWidth + 'px' }"
            aria-hidden="true"
          >
            <span :ref="observeLabel" class="invisible block w-max max-w-[calc(100cqi-5.5rem)] truncate">{{
              triggerText
            }}</span>
            <Transition name="period-label">
              <span :key="triggerText" class="absolute inset-0 truncate">{{ triggerText }}</span>
            </Transition>
          </span>
        </Button>
      </template>
    </DateSelector>

    <Button
      size="icon-sm"
      variant="ghost"
      class="size-11 shrink-0"
      :disabled="isNextDisabled"
      :aria-label="$t('dashboard.periodSelector.nextPeriod')"
      @click="selectNextPeriod"
    >
      <ChevronRight :size="16" />
    </Button>
    <Button
      size="icon-sm"
      variant="ghost"
      class="absolute left-0 z-10 size-11 touch-manipulation motion-safe:transition-opacity md:left-6"
      :class="isCurrentPayPeriod(period) && !resetAnimating && 'pointer-events-none opacity-0'"
      :disabled="isCurrentPayPeriod(period) || resetAnimating"
      :aria-hidden="isCurrentPayPeriod(period) && !resetAnimating"
      :aria-label="$t('dashboard.periodSelector.backToCurrent')"
      :title="$t('dashboard.periodSelector.backToCurrent')"
      @click="resetPeriod"
    >
      <RotateCcw
        class="size-4"
        :class="resetAnimating && 'lajur-period-reset'"
        aria-hidden="true"
        @animationend="resetAnimating = false"
        @animationcancel="resetAnimating = false"
      />
    </Button>
  </div>
</template>

<script lang="ts" setup>
import Button from '@/components/lib/ui/button/Button.vue';
import { DateSelector, type DateSelectorPreset } from '@/components/lib/ui/date-selector';
import { useEarliestTransactionDate } from '@/composable/data-queries/earliest-transaction-date';
import { getPayPeriod, usePeriodNavigation } from '@/composable/use-period-navigation';
import { format as dateFnsFormat, endOfYear, isBefore, isSameDay, startOfYear, subMonths, subYears } from 'date-fns';
import { ChevronLeft, ChevronRight, RotateCcw } from '@lucide/vue';
import { type ComponentPublicInstance, computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { type Period } from '../types';

const { t, te } = useI18n();
const resetAnimating = ref(false);
const resetPeriod = () => {
  if (isCurrentPayPeriod(period.value)) return;
  resetAnimating.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  period.value = getCurrentPayPeriod();
};

let periodTouch: { x: number; y: number } | null = null;
const clearPeriodTouch = () => {
  periodTouch = null;
};
const onPeriodTouchStart = (event: TouchEvent) => {
  if (!window.matchMedia('(max-width: 767px)').matches || event.touches.length !== 1) return;
  const touch = event.touches[0]!;
  periodTouch = { x: touch.clientX, y: touch.clientY };
};
const onPeriodTouchEnd = (event: TouchEvent) => {
  if (!periodTouch || event.changedTouches.length !== 1) return;
  const start = periodTouch;
  periodTouch = null;
  const touch = event.changedTouches[0]!;
  const dx = touch.clientX - start.x;
  const dy = touch.clientY - start.y;
  if (Math.abs(dx) < 62 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  // Only this period strip responds; charts, input fields and browser back
  // gestures elsewhere retain their native behavior.
  if (dx > 0) selectPrevPeriod();
  else if (!isNextDisabled.value) selectNextPeriod();
  event.preventDefault();
};
const presetShort = (key: string) =>
  te(`dashboard.periodSelector.presetsShort.${key}`)
    ? t(`dashboard.periodSelector.presetsShort.${key}`)
    : t(`dashboard.periodSelector.presets.${key}`);

const props = defineProps<{
  modelValue: Period;
  payday: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Period];
}>();

const period = computed({
  get: () => props.modelValue,
  set: (value: Period) => emit('update:modelValue', value),
});

const labelWidth = ref<number>();
let labelElement: Element | null = null;
const labelObserver = new ResizeObserver(([entry]) => {
  if (entry) labelWidth.value = Math.ceil(entry.contentRect.width);
});
const observeLabel = (element: Element | ComponentPublicInstance | null) => {
  if (element === labelElement) return;
  labelObserver.disconnect();
  labelElement = element instanceof Element ? element : null;
  if (!labelElement) return;
  labelWidth.value = Math.ceil(labelElement.getBoundingClientRect().width);
  labelObserver.observe(labelElement);
};
onBeforeUnmount(() => labelObserver.disconnect());

const direction = ref(1);
watch(
  () => props.modelValue,
  (next, previous) => {
    direction.value = isBefore(next.from, previous.from) ? -1 : 1;
  },
  { flush: 'sync' },
);

const { prevPeriod, nextPeriod } = usePeriodNavigation({
  period: () => props.modelValue,
  payday: () => props.payday,
});

const getCurrentPayPeriod = () => getPayPeriod({ date: new Date(), payday: props.payday });

const lastPayPeriods = (count: number) => (): Period => {
  const current = getCurrentPayPeriod();
  return { from: subMonths(current.from, count - 1), to: current.to };
};

const { earliestDate } = useEarliestTransactionDate();

const isNextDisabled = computed(() => !isBefore(props.modelValue.to, getCurrentPayPeriod().from));

function selectPrevPeriod() {
  period.value = prevPeriod.value;
}

function selectNextPeriod() {
  if (isNextDisabled.value) return;
  period.value = nextPeriod.value;
}

function isCurrentPayPeriod(p: Period): boolean {
  const current = getCurrentPayPeriod();
  return isSameDay(p.from, current.from) && isSameDay(p.to, current.to);
}

// Sync period to URL using history.replaceState
watch(
  () => props.modelValue,
  (p) => {
    const url = new URL(window.location.href);

    if (isCurrentPayPeriod(p)) {
      url.searchParams.delete('from');
      url.searchParams.delete('to');
    } else {
      url.searchParams.set('from', dateFnsFormat(p.from, 'yyyy-MM-dd'));
      url.searchParams.set('to', dateFnsFormat(p.to, 'yyyy-MM-dd'));
    }

    window.history.replaceState(history.state, '', url);
  },
  { deep: true },
);

const quickPresets = computed<DateSelectorPreset[]>(() => [
  {
    label: t('dashboard.periodSelector.presets.currentMonth'),
    shortLabel: presetShort('currentMonth'),
    getValue: getCurrentPayPeriod,
  },
  {
    label: t('dashboard.periodSelector.presets.last3Months'),
    shortLabel: presetShort('last3Months'),
    getValue: lastPayPeriods(3),
  },
  {
    label: t('dashboard.periodSelector.presets.last6Months'),
    shortLabel: presetShort('last6Months'),
    getValue: lastPayPeriods(6),
  },
  {
    label: t('dashboard.periodSelector.presets.lastYear'),
    shortLabel: presetShort('lastYear'),
    getValue: lastPayPeriods(12),
  },
  {
    label: t('dashboard.periodSelector.presets.thisYear'),
    shortLabel: presetShort('thisYear'),
    getValue: () => ({
      from: startOfYear(new Date()),
      to: new Date(),
    }),
  },
  {
    label: t('dashboard.periodSelector.presets.previousYear'),
    shortLabel: presetShort('previousYear'),
    getValue: () => {
      const prevYear = subYears(new Date(), 1);
      return {
        from: startOfYear(prevYear),
        to: endOfYear(prevYear),
      };
    },
  },
]);
</script>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .period-label-enter-active,
  .period-label-leave-active {
    transition:
      opacity 170ms ease-out,
      transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .period-label-enter-from {
    opacity: 0;
    transform: translateX(calc(var(--period-direction) * 9px));
  }
  .period-label-leave-to {
    opacity: 0;
    transform: translateX(calc(var(--period-direction) * -9px));
  }
  .period-label-leave-active:not(:nth-last-child(2)) {
    visibility: hidden;
  }
}
</style>
