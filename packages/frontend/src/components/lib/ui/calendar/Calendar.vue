<script setup lang="ts">
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { Button, buttonVariants } from '@/components/lib/ui/button';
import * as Dialog from '@/components/lib/ui/dialog';
import { useDateLocale } from '@/composable/use-date-locale';
import { i18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useResizeObserver, useVModel } from '@vueuse/core';
import { ChevronLeft, ChevronRight } from '@lucide/vue';
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
const selectedYear = ref<HTMLElement | null>(null);
const yearWindowStart = ref(1);
const YEAR_PAGE_SIZE = 48;
const yearInputId = useId();
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
const toggleYearPicker = async () => {
  choosingYear.value = !choosingYear.value;
  if (!choosingYear.value || typeof navigationYear.value !== 'number') return;
  yearWindowStart.value = Math.max(
    minYear.value,
    Math.min(navigationYear.value - 24, maxYear.value - YEAR_PAGE_SIZE + 1),
  );
  await nextTick();
  selectedYear.value?.focus({ preventScroll: true });
  selectedYear.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};
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
        <ChevronLeft class="size-4" aria-hidden="true" />
      </Button>
      <Dialog.Dialog v-model:open="isMonthPickerOpen">
        <Dialog.DialogTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            class="h-auto min-h-11 min-w-0 overflow-hidden px-3 whitespace-nowrap motion-safe:transition-[width] motion-safe:duration-200"
            :style="titleWidth ? { width: `calc(${titleWidth}px + 1.5rem)` } : undefined"
            :aria-label="i18n.global.t('common.dateSelector.chooseMonthYear', { month: monthTitle })"
            data-testid="calendar-month-trigger"
          >
            <span ref="monthLabel" class="inline-block w-max shrink-0">{{ monthTitle }}</span>
          </Button>
        </Dialog.DialogTrigger>
        <Dialog.DialogContent
          raised
          blur-overlay
          custom-close
          class="w-[calc(100%-1.5rem)] max-w-sm overflow-y-auto p-3 sm:p-5"
          data-testid="calendar-month-picker"
          @open-auto-focus="focusMonthPicker"
        >
          <Dialog.DialogTitle class="text-base font-semibold" tabindex="-1" data-calendar-picker-title>
            {{ i18n.global.t('common.dateSelector.monthYearTitle') }}
          </Dialog.DialogTitle>
          <div class="my-1 flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-11"
              :aria-label="i18n.global.t('common.dateSelector.previousYear')"
              :disabled="typeof navigationYear !== 'number' || navigationYear <= minYear"
              @click="typeof navigationYear === 'number' && navigationYear--"
              ><ChevronLeft class="size-4" aria-hidden="true"
            /></Button>
            <Button
              type="button"
              variant="outline"
              class="min-h-11 tabular-nums"
              :aria-expanded="choosingYear"
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
              @click="typeof navigationYear === 'number' && navigationYear++"
              ><ChevronRight class="size-4" aria-hidden="true"
            /></Button>
          </div>
          <LayoutCollapse :open="choosingYear">
            <div class="space-y-2 pb-2">
              <label :for="yearInputId" class="sr-only">{{ i18n.global.t('common.dateSelector.year') }}</label>
              <input
                :id="yearInputId"
                v-model.number="navigationYear"
                type="number"
                inputmode="numeric"
                :min="minYear"
                :max="maxYear"
                step="1"
                class="border-input bg-input-background focus-visible:ring-ring h-11 w-full rounded-md border px-2 text-center text-base focus-visible:ring-2 focus-visible:outline-none"
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
                  <ChevronLeft class="size-4" aria-hidden="true" />
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
                  <ChevronRight class="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div class="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto overscroll-contain">
                <Button
                  v-for="year in years"
                  :key="year"
                  type="button"
                  :variant="year === navigationYear ? 'soft-primary' : 'ghost'"
                  :aria-pressed="year === navigationYear"
                  class="min-h-11 px-1 tabular-nums"
                  :ref="
                    (element) => {
                      if (year === navigationYear && element && '$el' in element) selectedYear = element.$el;
                    }
                  "
                  @click="
                    navigationYear = year;
                    choosingYear = false;
                  "
                  >{{ year }}</Button
                >
              </div>
            </div>
          </LayoutCollapse>
          <div class="grid grid-cols-3 gap-1">
            <Button
              v-for="month in months"
              :key="month"
              type="button"
              :variant="navigationMonth === month ? 'soft-primary' : 'ghost'"
              :aria-pressed="navigationMonth === month"
              :aria-label="format(dateInMonth({ year: displayedMonth.year, month }), 'MMMM')"
              :disabled="!isMonthAllowed(month)"
              class="min-h-11 min-w-0 px-1 whitespace-normal"
              @click="navigationMonth = month"
              >{{ format(dateInMonth({ year: displayedMonth.year, month }), 'MMM') }}</Button
            >
          </div>
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
        <ChevronRight class="size-4" aria-hidden="true" />
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
        <ChevronLeft class="size-4" />
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
        <ChevronRight class="size-4" />
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
