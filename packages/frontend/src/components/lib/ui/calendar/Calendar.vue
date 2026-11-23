<script setup lang="ts">
import { Button, buttonVariants } from '@/components/lib/ui/button';
import * as Dialog from '@/components/lib/ui/dialog';
import { useDateLocale } from '@/composable/use-date-locale';
import { i18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useVModel } from '@vueuse/core';
import { ChevronDown, ChevronLeft, ChevronRight } from '@lucide/vue';
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
const yearInputId = useId();
const firstPage = computed(() => calendarRef.value?.pages[0]);
const displayedMonth = computed(() =>
  firstPage.value
    ? { month: firstPage.value.month - 1, year: firstPage.value.year }
    : { month: getMonth(new Date()), year: getYear(new Date()) },
);
const dateInMonth = ({ year, month }: { year: number; month: number }) =>
  set(startOfMonth(new Date()), { year, month, date: 1 });
const monthTitle = computed(() => format(dateInMonth(displayedMonth.value), 'MMMM yyyy'));
const minYear = computed(() => (props.minDate && isValid(props.minDate) ? getYear(props.minDate) : 1));
const maxYear = computed(() => (props.maxDate && isValid(props.maxDate) ? getYear(props.maxDate) : 9999));
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
  if (open) navigationYear.value = displayedMonth.value.year;
});
const selectMonth = (month: number) => {
  if (typeof navigationYear.value !== 'number' || !isMonthAllowed(month)) return;
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
      class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1"
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
            class="h-auto min-h-11 min-w-0 gap-1 whitespace-normal"
            :aria-label="i18n.global.t('common.dateSelector.chooseMonthYear', { month: monthTitle })"
            data-testid="calendar-month-trigger"
          >
            <span class="min-w-0 text-balance">{{ monthTitle }}</span>
            <ChevronDown class="size-3.5 shrink-0" aria-hidden="true" />
          </Button>
        </Dialog.DialogTrigger>
        <Dialog.DialogContent
          raised
          blur-overlay
          class="w-[calc(100%-1.5rem)] max-w-sm overflow-y-auto p-3 sm:p-5"
          data-testid="calendar-month-picker"
          @open-auto-focus="focusMonthPicker"
        >
          <Dialog.DialogTitle class="pr-11 text-base font-semibold" tabindex="-1" data-calendar-picker-title>
            {{ i18n.global.t('common.dateSelector.monthYearTitle') }}
          </Dialog.DialogTitle>
          <div class="my-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-11"
              :aria-label="i18n.global.t('common.dateSelector.previousYear')"
              :disabled="typeof navigationYear !== 'number' || navigationYear <= minYear || navigationYear > maxYear"
              @click="typeof navigationYear === 'number' && navigationYear--"
              ><ChevronLeft class="size-4" aria-hidden="true"
            /></Button>
            <label :for="yearInputId" class="sr-only">{{ i18n.global.t('common.dateSelector.year') }}</label>
            <input
              :id="yearInputId"
              v-model.number="navigationYear"
              type="number"
              inputmode="numeric"
              :min="minYear"
              :max="maxYear"
              step="1"
              class="border-input bg-input-background focus-visible:ring-ring h-11 w-full min-w-0 rounded-md border px-2 text-center text-base tabular-nums focus-visible:ring-2 focus-visible:outline-none"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-11"
              :aria-label="i18n.global.t('common.dateSelector.nextYear')"
              :disabled="typeof navigationYear !== 'number' || navigationYear < minYear || navigationYear >= maxYear"
              @click="typeof navigationYear === 'number' && navigationYear++"
              ><ChevronRight class="size-4" aria-hidden="true"
            /></Button>
          </div>
          <div class="grid grid-cols-3 gap-1">
            <Button
              v-for="month in months"
              :key="month"
              type="button"
              :variant="
                displayedMonth.month === month && displayedMonth.year === navigationYear ? 'soft-primary' : 'ghost'
              "
              :aria-pressed="displayedMonth.month === month && displayedMonth.year === navigationYear"
              :aria-label="format(dateInMonth({ year: displayedMonth.year, month }), 'MMMM')"
              :disabled="!isMonthAllowed(month)"
              class="min-h-11 min-w-0 px-1 whitespace-normal"
              @click="selectMonth(month)"
              >{{ format(dateInMonth({ year: displayedMonth.year, month }), 'MMM') }}</Button
            >
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
