<script setup lang="ts">
import InputField from '@/components/fields/input-field.vue';
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { Button, buttonVariants } from '@/components/lib/ui/button';
import * as Dialog from '@/components/lib/ui/dialog';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { useDateLocale } from '@/composable/use-date-locale';
import { i18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { usePreferredReducedMotion, useResizeObserver, useVModel } from '@vueuse/core';
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue';
import { getMonth, getYear, isDate, isValid, set, startOfMonth } from 'date-fns';
import { DatePicker } from 'v-calendar';
import { computed, nextTick, onMounted, ref, useId, useSlots, watch } from 'vue';

import { isVCalendarSlot } from '../calendar';

/* Extracted from v-calendar */
interface SimpleDateParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}
type DateSource = Date | string | number;
type DatePickerDate = DateSource | Partial<SimpleDateParts> | null;
interface DatePickerRangeObject {
  start: Exclude<DatePickerDate, null>;
  end: Exclude<DatePickerDate, null>;
}
type DatePickerModel = DatePickerDate | DatePickerRangeObject;

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | Date | DatePickerModel;
    modelModifiers?: object;
    columns?: number;
    type?: 'single' | 'range';
    monthNavigation?: boolean;
    minDate?: Date;
    maxDate?: Date;
  }>(),
  {
    type: 'single',
    columns: 1,
    modelValue: undefined,
    modelModifiers: undefined,
    minDate: undefined,
    maxDate: undefined,
  },
);
const emits = defineEmits<{
  (e: 'update:modelValue', payload: typeof props.modelValue): void;
}>();

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
});

const datePicker = ref<InstanceType<typeof DatePicker>>();
// In this current version of v-calendar has the calendarRef instance, which is
// required to handle arrow nav.
const calendarRef = computed(() => datePicker.value?.calendarRef);

function handleNav(direction: 'prev' | 'next') {
  if (!calendarRef.value) return;

  if (direction === 'prev') calendarRef.value.movePrev();
  else calendarRef.value.moveNext();
}

const { format } = useDateLocale();
const isMonthPickerOpen = ref(false);
const navigationYear = ref<number | ''>('');
const navigationMonth = ref(0);
const choosingYear = ref(false);
const yearGrid = ref<HTMLElement | null>(null);
const prefersReducedMotion = usePreferredReducedMotion();
const yearWindowStart = ref(1);
const YEAR_PAGE_SIZE = 48;
const yearPickerId = useId();
const yearLabelId = useId();
const firstPage = computed(() => calendarRef.value?.pages[0]);
const displayedMonth = computed(() =>
  firstPage.value
    ? { month: firstPage.value.month - 1, year: firstPage.value.year }
    : { month: getMonth(new Date()), year: getYear(new Date()) },
);
const dateInMonth = ({ year, month }: { year: number; month: number }) =>
  set(startOfMonth(new Date()), { year, month, date: 1 });
const monthLabel = ref<HTMLElement | null>(null);
const titleWidth = ref<number>();
useResizeObserver(monthLabel, ([entry]) => {
  if (entry) titleWidth.value = Math.ceil(entry.contentRect.width);
});
const monthTitle = computed(() => format(dateInMonth(displayedMonth.value), 'MMMM yyyy'));
const minYear = computed(() => (props.minDate && isValid(props.minDate) ? getYear(props.minDate) : 1));
const maxYear = computed(() => (props.maxDate && isValid(props.maxDate) ? getYear(props.maxDate) : 9999));
const years = computed(() => {
  const count = Math.min(YEAR_PAGE_SIZE, maxYear.value - yearWindowStart.value + 1);
  return Array.from({ length: count }, (_, index) => yearWindowStart.value + index);
});
const changeYearPage = (direction: number) => {
  yearWindowStart.value = Math.max(
    minYear.value,
    Math.min(maxYear.value, yearWindowStart.value + direction * YEAR_PAGE_SIZE),
  );
};
const revealSelectedYear = async () => {
  await nextTick();
  if (!choosingYear.value) return;
  const selected = yearGrid.value?.querySelector<HTMLElement>('[aria-pressed="true"]');
  const viewport = yearGrid.value?.closest<HTMLElement>('[data-reka-scroll-area-viewport]');
  if (!selected || !viewport) return;
  const selectedBounds = selected.getBoundingClientRect();
  const viewBounds = viewport.getBoundingClientRect();
  const target = selectedBounds.top - viewBounds.top - (viewBounds.height - selectedBounds.height) / 2;
  viewport.scrollBy({ top: target, behavior: prefersReducedMotion.value === 'reduce' ? 'instant' : 'smooth' });
};
const shiftYear = ({ offset }: { offset: -1 | 1 }) => {
  if (typeof navigationYear.value !== 'number') return;
  navigationYear.value += offset;
  void revealSelectedYear();
};
const centerYearWindow = ({ year }: { year: number }) => {
  yearWindowStart.value = Math.max(
    minYear.value,
    Math.min(year - YEAR_PAGE_SIZE / 2, maxYear.value - YEAR_PAGE_SIZE + 1),
  );
};
const revealNavigationYear = () => {
  const year = navigationYear.value;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < minYear.value || year > maxYear.value) return;
  if (!years.value.includes(year)) centerYearWindow({ year });
  void revealSelectedYear();
};
const toggleYearPicker = () => {
  choosingYear.value = !choosingYear.value;
  if (choosingYear.value) revealNavigationYear();
};
const selectedYearIndex = computed(() =>
  typeof navigationYear.value === 'number' ? years.value.indexOf(navigationYear.value) : -1,
);
const yearIndicatorStyle = computed(() => ({
  '--pick-column': selectedYearIndex.value % 4,
  '--pick-row': Math.floor(selectedYearIndex.value / 4),
}));
const monthIndicatorStyle = computed(() => ({
  '--pick-column': navigationMonth.value % 3,
  '--pick-row': Math.floor(navigationMonth.value / 3),
}));
const months = Array.from({ length: 12 }, (_, month) => month);
const monthNumber = ({ year, month }: { year: number; month: number }) => year * 12 + month;
const boundaryMonth = (date: Date | undefined, fallback: number) =>
  date && isDate(date) && isValid(date) ? monthNumber({ year: getYear(date), month: getMonth(date) }) : fallback;
const isMonthAllowed = (month: number) => {
  const year = navigationYear.value;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < minYear.value || year > maxYear.value) return false;
  const candidate = monthNumber({ year, month });
  return candidate >= boundaryMonth(props.minDate, -Infinity) && candidate <= boundaryMonth(props.maxDate, Infinity);
};
watch(isMonthPickerOpen, (open) => {
  if (!open) return;
  navigationYear.value = displayedMonth.value.year;
  navigationMonth.value = displayedMonth.value.month;
  centerYearWindow({ year: displayedMonth.value.year });
  choosingYear.value = false;
});
const monthPickerChanged = computed(
  () =>
    (navigationMonth.value !== displayedMonth.value.month || navigationYear.value !== displayedMonth.value.year) &&
    isMonthAllowed(navigationMonth.value),
);
const saveMonth = () => {
  const month = navigationMonth.value;
  if (typeof navigationYear.value !== 'number' || !monthPickerChanged.value) return;
  const destination = dateInMonth({ year: navigationYear.value, month });
  void calendarRef.value?.move(destination);
  isMonthPickerOpen.value = false;
};
const focusMonthPicker = (event: Event) => {
  const title = (event.target as HTMLElement | null)?.querySelector<HTMLElement>('[data-calendar-picker-title]');
  if (!title) return;
  event.preventDefault();
  title.focus({ preventScroll: true });
};

onMounted(async () => {
  await nextTick();
  if (!(modelValue.value instanceof Date) || !calendarRef.value) return;
  if (props.monthNavigation) calendarRef.value.move(modelValue.value);
  else calendarRef.value.focusDate(modelValue.value);
});

// Reactive locale for v-calendar - tracks i18n locale changes
const calendarLocale = computed(() => {
  // Access the reactive locale value to ensure reactivity (locale is same as getCurrentLocale())
  return i18n.global.locale.value;
});

const $slots = useSlots();
const vCalendarSlots = computed(() =>
  Object.keys($slots)
    .filter((name) => isVCalendarSlot(name))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((obj: Record<string, any>, key: string) => {
      // eslint-disable-next-line no-param-reassign
      obj[key] = $slots[key];
      return obj;
    }, {}),
);
</script>

<template>
  <div class="relative min-w-0" :class="{ 'w-full': monthNavigation }">
    <div
      v-if="monthNavigation"
      class="mx-auto flex w-fit max-w-full items-center justify-center gap-1"
      data-testid="calendar-month-header"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-11"
        :disabled="!calendarRef?.canMovePrev"
        :aria-label="i18n.global.t('common.dateSelector.previousPage')"
        @click="handleNav('prev')"
      >
        <ChevronLeftIcon class="size-4" aria-hidden="true" />
      </Button>
      <Dialog.Dialog v-model:open="isMonthPickerOpen">
        <Dialog.DialogTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            class="calendar-month-label relative h-auto min-h-11 min-w-0 overflow-hidden px-3 whitespace-nowrap motion-safe:transition-[width] motion-safe:duration-(--kasana-motion-normal) motion-safe:ease-(--kasana-motion-ease)"
            :style="titleWidth ? { width: `calc(${titleWidth}px + 1.5rem)` } : undefined"
            :aria-label="i18n.global.t('common.dateSelector.chooseMonthYear', { month: monthTitle })"
            data-testid="calendar-month-trigger"
          >
            <Transition name="lajur-form-copy">
              <span :key="monthTitle" ref="monthLabel" class="inline-block w-max shrink-0">{{ monthTitle }}</span>
            </Transition>
          </Button>
        </Dialog.DialogTrigger>
        <Dialog.DialogContent
          raised
          blur-overlay
          custom-close
          intrinsic-height-motion
          class="grid max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-sm grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden p-3 sm:p-5"
          data-testid="calendar-month-picker"
          @open-auto-focus="focusMonthPicker"
        >
          <Dialog.DialogTitle class="text-base font-semibold" tabindex="-1" data-calendar-picker-title>
            {{ i18n.global.t('common.dateSelector.monthYearTitle') }}
          </Dialog.DialogTitle>
          <ScrollArea class="min-h-0" viewport-class="overscroll-y-contain">
            <div class="my-1 flex items-center justify-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-11"
                :aria-label="i18n.global.t('common.dateSelector.previousYear')"
                :disabled="typeof navigationYear !== 'number' || navigationYear <= minYear"
                @click="
                  typeof navigationYear === 'number' && navigationYear--;
                  revealSelectedYear();
                "
                ><ChevronLeftIcon class="size-4" aria-hidden="true"
              /></Button>
              <Button
                type="button"
                variant="outline"
                class="min-h-11 tabular-nums"
                :aria-expanded="choosingYear"
                :aria-controls="yearPickerId"
                :aria-label="i18n.global.t('common.dateSelector.year')"
                @click="toggleYearPicker"
                >{{ navigationYear }}</Button
              >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-11"
                :aria-label="i18n.global.t('common.dateSelector.nextYear')"
                :disabled="typeof navigationYear !== 'number' || navigationYear >= maxYear"
                @click="
                  typeof navigationYear === 'number' && navigationYear++;
                  revealSelectedYear();
                "
                ><ChevronRightIcon class="size-4" aria-hidden="true"
              /></Button>
            </div>
            <LayoutCollapse :open="choosingYear">
              <div :id="yearPickerId" class="space-y-2 pb-2">
                <span :id="yearLabelId" class="sr-only">{{ $t('common.dateSelector.year') }}</span>
                <InputField
                  :aria-labelledby="yearLabelId"
                  :model-value="navigationYear"
                  type="number"
                  inputmode="numeric"
                  :placeholder="i18n.global.t('common.dateSelector.year')"
                  :min="minYear"
                  :max="maxYear"
                  step="1"
                  class="h-11 px-2 text-center tabular-nums md:h-11"
                  @update:model-value="navigationYear = typeof $event === 'number' ? $event : ''"
                  @blur="revealNavigationYear"
                />
                <div class="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    :disabled="yearWindowStart <= minYear"
                    :aria-label="i18n.global.t('common.dateSelector.previousPage')"
                    @click="changeYearPage(-1)"
                  >
                    <ChevronLeftIcon class="size-4" aria-hidden="true" />
                  </Button>
                  <span class="text-muted-foreground text-sm">{{ years[0] }}–{{ years.at(-1) }}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    :disabled="yearWindowStart + YEAR_PAGE_SIZE > maxYear"
                    :aria-label="i18n.global.t('common.dateSelector.nextPage')"
                    @click="changeYearPage(1)"
                  >
                    <ChevronRightIcon class="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <ScrollArea type="auto" viewport-class="max-h-36 overscroll-y-contain">
                  <div
                    ref="yearGrid"
                    class="calendar-picker-grid grid-cols-4 [--pick-columns:4]"
                    data-testid="calendar-year-grid"
                  >
                    <span
                      aria-hidden="true"
                      class="calendar-picker-indicator"
                      :class="{ 'opacity-0': selectedYearIndex < 0 }"
                      :style="yearIndicatorStyle"
                    />
                    <Button
                      v-for="year in years"
                      :key="year"
                      type="button"
                      variant="ghost"
                      :aria-pressed="year === navigationYear"
                      class="aria-pressed:text-primary-text relative z-1 h-full min-w-0 px-1 tabular-nums aria-pressed:bg-transparent"
                      @click="navigationYear = year"
                    >
                      {{ year }}
                    </Button>
                  </div>
                </ScrollArea>
              </div>
            </LayoutCollapse>
            <div class="calendar-picker-grid grid-cols-3 [--pick-columns:3]" data-testid="calendar-month-grid">
              <span aria-hidden="true" class="calendar-picker-indicator" :style="monthIndicatorStyle" />
              <Button
                v-for="month in months"
                :key="month"
                type="button"
                variant="ghost"
                :aria-pressed="navigationMonth === month"
                :aria-label="format(dateInMonth({ year: displayedMonth.year, month }), 'MMMM')"
                :disabled="!isMonthAllowed(month)"
                class="aria-pressed:text-primary-text relative z-1 h-full min-w-0 px-1 aria-pressed:bg-transparent"
                @click="navigationMonth = month"
              >
                <span class="truncate">{{ format(dateInMonth({ year: displayedMonth.year, month }), 'MMM') }}</span>
              </Button>
            </div>
          </ScrollArea>
          <div class="border-border mt-2 flex justify-end gap-2 border-t pt-2">
            <Button type="button" size="sm" variant="outline" class="min-h-11" @click="isMonthPickerOpen = false">
              {{ i18n.global.t('common.actions.cancel') }}
            </Button>
            <Button type="button" size="sm" class="min-h-11" :disabled="!monthPickerChanged" @click="saveMonth">
              {{ i18n.global.t('common.actions.save') }}
            </Button>
          </div>
        </Dialog.DialogContent>
      </Dialog.Dialog>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-11"
        :disabled="!calendarRef?.canMoveNext"
        :aria-label="i18n.global.t('common.dateSelector.nextPage')"
        @click="handleNav('next')"
      >
        <ChevronRightIcon class="size-4" aria-hidden="true" />
      </Button>
    </div>
    <div
      v-else-if="$attrs.mode !== 'time'"
      class="pointer-events-none absolute top-2 z-1 flex w-full justify-between px-3"
    >
      <button
        type="button"
        :class="
          cn(
            buttonVariants({ variant: 'outline' }),
            'text-muted-foreground hover:text-foreground pointer-events-auto size-9 bg-transparent p-0',
          )
        "
        :aria-label="i18n.global.t('common.dateSelector.previousPage')"
        @click="handleNav('prev')"
      >
        <ChevronLeftIcon class="size-4" />
      </button>
      <button
        type="button"
        :class="
          cn(
            buttonVariants({ variant: 'outline' }),
            'text-muted-foreground hover:text-foreground pointer-events-auto size-9 bg-transparent p-0',
          )
        "
        :aria-label="i18n.global.t('common.dateSelector.nextPage')"
        @click="handleNav('next')"
      >
        <ChevronRightIcon class="size-4" />
      </button>
    </div>

    <DatePicker
      ref="datePicker"
      v-model="modelValue"
      v-bind="$attrs"
      :model-modifiers="modelModifiers"
      :min-date="minDate"
      :max-date="maxDate"
      :locale="calendarLocale"
      class="calendar"
      :class="{ 'calendar--month-navigation': monthNavigation }"
      :trim-weeks="!monthNavigation"
      :nav-visibility="monthNavigation ? 'hidden' : undefined"
      :first-day-of-week="monthNavigation && calendarLocale === 'id' ? 2 : undefined"
      :transition="'slide-h'"
      :columns="columns"
    >
      <template v-for="(_, slot) of vCalendarSlots" #[slot]="scope">
        <slot :name="slot" v-bind="scope" />
      </template>
    </DatePicker>
  </div>
</template>

<style scoped>
.calendar-month-label .lajur-form-copy-leave-active {
  position: absolute;
  pointer-events: none;
}

.calendar-picker-grid {
  --pick-gap: 0.25rem;
  --pick-row-height: 2.75rem;
  --pick-width: calc((100% - (var(--pick-columns) - 1) * var(--pick-gap)) / var(--pick-columns));
  position: relative;
  display: grid;
  gap: var(--pick-gap);
  grid-auto-rows: var(--pick-row-height);
}

.calendar-picker-indicator {
  pointer-events: none;
  position: absolute;
  inset: 0 auto auto 0;
  width: var(--pick-width);
  height: var(--pick-row-height);
  border-radius: var(--radius-md);
  background-color: color-mix(in oklab, var(--primary) 15%, transparent);
  translate: calc(var(--pick-column) * (100% + var(--pick-gap))) calc(var(--pick-row) * (100% + var(--pick-gap)));
  transition:
    translate var(--kasana-motion-normal) var(--kasana-motion-ease),
    opacity var(--kasana-motion-fast);
}

@media (prefers-reduced-motion: reduce) {
  .calendar-picker-indicator {
    transition: none;
  }
}
</style>
