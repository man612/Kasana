<template>
  <div
    class="relative"
    :class="[
      $slots.trigger ? 'max-w-full min-w-0' : 'w-full flex-1',
      { 'date-field--error': errorMessage, 'date-field--disabled': disabled },
    ]"
  >
    <Dialog.Dialog v-model:open="isPopoverOpen">
      <FieldLabel v-if="!$slots.trigger" :label="label" :only-template="Boolean($slots['label-right'])">
        <template v-if="$slots['label-right']" #label-right><slot name="label-right" /></template>
        <template v-if="$slots['label-after']" #label-after>
          <slot name="label-after" />
        </template>
        <div class="flex min-w-0 items-center gap-2">
          <div class="relative min-w-0 flex-1">
            <!-- Without a 4-digit-year max, Chrome accepts 6-digit years and never auto-advances past the year segment. -->
            <input
              v-if="!showWeekday"
              :value="inputValue"
              type="date"
              :max="nativeMax"
              :min="nativeMin"
              :disabled="disabled"
              :class="
                cn(
                  'datetime-local-raw-input',
                  // Keep px-3: extra right padding pushes Firefox's native picker
                  // icon out from under the addon overlay that covers it.
                  'border-input bg-input-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm md:h-9',
                  'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                  'placeholder:text-muted-foreground',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'appearance-none', // fixes Safari width issues
                  $attrs.class ?? '',
                )
              "
              @input="handleLocalInputUpdate"
              @blur="handleBlur"
            />
            <div v-else class="relative">
              <input
                :value="inputValue"
                type="text"
                inputmode="numeric"
                maxlength="10"
                placeholder="dd/MM/yyyy"
                :disabled="disabled"
                data-testid="date-field-numeric-input"
                :aria-label="i18n.global.t('common.dateSelector.numericInputHelp')"
                class="border-input bg-input-background focus-visible:ring-ring h-10 w-full rounded-md border py-2 pr-14 pl-3 text-base tabular-nums focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:pr-36 md:text-sm"
                @input="handleLocalInputUpdate"
                @blur="handleBlur"
                @keydown.enter.prevent="handleBlur($event)"
              />
              <span
                v-if="friendlyWeekday"
                aria-hidden="true"
                class="text-muted-foreground pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 truncate text-xs max-md:hidden"
              >
                {{ friendlyWeekday }}
              </span>
            </div>

            <!-- Opaque instead of padding the input, so Firefox's native icon stays under the trigger. -->
            <Button
              v-if="clearable && modelValue && !disabled"
              type="button"
              variant="ghost"
              size="icon-sm"
              class="bg-input-background text-muted-foreground hover:text-foreground absolute top-1/2 right-12 -translate-y-1/2"
              :aria-label="$t('common.actions.clear')"
              @click="emit('clear')"
            >
              <XIcon class="size-4" />
            </Button>

            <!-- Keep this overlay opaque: it covers the native picker icon Firefox
               draws inside datetime-local inputs, which no CSS pseudo-element hides.
               Disabled where Safari mobile's native picker covers it, so taps fall through. -->
            <Dialog.DialogTrigger as-child>
              <Button
                class="border-input bg-muted text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-primary-text absolute top-0 right-0 flex h-10 w-12 items-center justify-center rounded-l-none rounded-r-md border md:h-9"
                variant="ghost"
                size="icon"
                :disabled="disabled || !isPopoverAvailable"
                :aria-label="label || i18n.global.t('common.dateSelector.simpleTitle')"
                data-testid="date-field-calendar-trigger"
              >
                <CalendarClockIcon class="size-5" />
              </Button>
            </Dialog.DialogTrigger>
          </div>
          <div v-if="!isDateOnlyInput && !hideInputTime" class="flex shrink-0 items-center gap-1">
            <input
              :value="timeValue"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              maxlength="5"
              placeholder="HH:mm"
              :aria-label="i18n.global.t('common.dateSelector.timeLabel')"
              class="border-input bg-input-background focus-visible:ring-ring h-10 w-[4.9rem] rounded-md border px-2 text-center text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none md:h-9"
              :disabled="disabled"
              data-testid="date-field-time-input"
              @input="handleTimeTyping"
              @blur="commitTimeInput"
              @keydown.enter.prevent="commitTimeInput"
            />
            <span class="text-muted-foreground min-w-7 text-xs">{{ timeZoneLabel }}</span>
            <DesktopOnlyTooltip
              :content="
                isNowInField
                  ? i18n.global.t('common.dateSelector.alreadyNow')
                  : i18n.global.t('common.dateSelector.nowHelp')
              "
              :delay-duration="isNowInField ? 850 : 0"
            >
              <span class="inline-flex shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="text-muted-foreground transition-[opacity,color,transform] duration-200"
                  :class="isNowInField && 'opacity-35'"
                  :disabled="disabled || isNowInField"
                  :aria-label="i18n.global.t('common.dateSelector.nowQuick')"
                  data-testid="date-field-now-button"
                  @click="applyNow"
                >
                  <Clock3Icon class="size-4" />
                </Button>
              </span>
            </DesktopOnlyTooltip>
          </div>
        </div>
        <FieldError :animated="animateError" :error-message="errorMessage" />
      </FieldLabel>
      <template v-else>
        <Dialog.DialogTrigger as-child>
          <slot name="trigger" :disabled="disabled || !isPopoverAvailable" />
        </Dialog.DialogTrigger>
        <FieldError :animated="animateError" :error-message="errorMessage" />
      </template>
      <Dialog.DialogContent
        blur-overlay
        custom-close
        intrinsic-height-motion
        class="grid max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-96 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden p-3 sm:p-5"
        data-testid="transaction-date-dialog"
      >
        <Dialog.DialogTitle class="text-base font-semibold">
          {{
            i18n.global.t(
              mode === 'date' ? 'common.dateSelector.calendarDateTitle' : 'common.dateSelector.dateTimeTitle',
            )
          }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription class="sr-only">
          {{ i18n.global.t('common.dateSelector.dateTimeHint') }}
        </Dialog.DialogDescription>
        <div class="grid min-h-0 min-w-0 gap-2 overflow-y-auto overscroll-contain">
          <div class="flex min-w-0 justify-center">
            <Calendar
              :key="calendarPageKey"
              v-model="localValue"
              v-bind="calendarOptions"
              :min-date="calendarOptions?.minDate ?? MIN_DATE"
              mode="date"
              type="single"
              month-navigation
            />
          </div>
          <div class="text-muted-foreground flex items-center gap-2 text-xs">
            <span class="ring-border size-2 shrink-0 rounded-full ring-1" aria-hidden="true" />
            {{ i18n.global.t('common.dateSelector.todayIndicator') }}: {{ todayLabel }}
          </div>
          <div v-if="mode !== 'date'" class="flex items-center justify-between gap-3">
            <label :for="timeInputId" class="text-sm font-medium">
              {{ i18n.global.t('common.dateSelector.timeLabel') }} ({{ timeZoneLabel }})
            </label>
            <div v-if="usesNativeTime" class="relative">
              <Button
                :id="timeInputId"
                type="button"
                variant="outline"
                class="bg-input-background active:bg-muted h-9 w-24 px-2 tabular-nums"
                aria-haspopup="dialog"
                :aria-label="`${$t('common.dateSelector.timeLabel')} (${timeZoneLabel}) ${dialogTimeValue}`"
                data-testid="date-dialog-time-input"
                @click="showNativeTimePicker"
              >
                {{ dialogTimeValue }}
              </Button>
              <input
                ref="nativeTimeInput"
                :value="dialogTimeValue"
                type="time"
                tabindex="-1"
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                @input="handleDialogTimeTyping"
              />
            </div>
            <input
              v-else
              :id="timeInputId"
              ref="typedTimeInput"
              :value="dialogTimeValue"
              type="text"
              inputmode="numeric"
              maxlength="5"
              placeholder="HH:mm"
              class="border-input bg-input-background focus-visible:ring-ring h-9 w-24 rounded-md border px-2 text-center text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none"
              data-testid="date-dialog-time-input"
              @input="handleDialogTimeTyping"
            />
          </div>
          <p v-if="dialogTimeError" class="text-destructive text-xs" role="alert">
            {{ i18n.global.t('common.dateSelector.invalidTime') }}
          </p>
        </div>
        <div class="border-border flex flex-wrap items-center justify-between gap-1 border-t pt-2">
          <LayoutCollapse :open="showDialogNow">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="text-muted-foreground min-h-11 px-2"
              :disabled="!showDialogNow"
              data-testid="date-dialog-now"
              @click="setDialogNow"
            >
              {{ i18n.global.t('common.dateSelector.nowQuick') }}
            </Button>
          </LayoutCollapse>
          <div class="ml-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" class="min-h-11" @click="isPopoverOpen = false">
              {{ i18n.global.t('common.actions.cancel') }}
            </Button>
            <Button
              type="button"
              size="sm"
              class="min-h-11"
              data-testid="date-dialog-save"
              :disabled="dialogTimeError || !dialogChanged || !isWithinCalendarBounds(localValue)"
              @click="saveDialogDate"
            >
              {{ i18n.global.t('common.actions.save') }}
            </Button>
          </div>
        </div>
      </Dialog.DialogContent>
    </Dialog.Dialog>
  </div>
</template>

<script setup lang="ts">
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import { Button } from '@/components/lib/ui/button';
import { Calendar } from '@/components/lib/ui/calendar';
import * as Dialog from '@/components/lib/ui/dialog';
import { i18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { format, getDate, getMonth, getYear, parse, set, startOfDay } from 'date-fns';
import { CalendarClockIcon, Clock3Icon, XIcon } from '@lucide/vue';
import { computed, nextTick, ref, useId, watch } from 'vue';
import { useDocumentVisibility, useIntervalFn, useMediaQuery } from '@vueuse/core';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { getDateFnsLocale } from '@/composable/use-date-locale';
import { getLocalTimeZoneLabel } from '@/common/utils/indonesian-time';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label?: string;
    modelValue?: Date;
    type?: string;
    tabindex?: string;
    errorMessage?: string;
    animateError?: boolean;
    inputFieldStyles?: Record<string, string>;
    disabled?: boolean;
    calendarOptions?: {
      minDate?: Date;
      maxDate?: Date;
    };
    mode?: 'date' | 'dateTime';
    clearable?: boolean;
    /** The input shows only the date; the time stays editable in the calendar popover. */
    hideInputTime?: boolean;
    /** Use a localized weekday+date trigger instead of the OS-dependent native date text. */
    showWeekday?: boolean;
    liveOnOpen?: boolean;
  }>(),
  {
    label: undefined,
    modelValue: undefined,
    type: undefined,
    tabindex: undefined,
    errorMessage: undefined,
    inputFieldStyles: undefined,
    disabled: false,
    calendarOptions: undefined,
    mode: 'dateTime',
    clearable: false,
    hideInputTime: false,
    showWeekday: false,
    liveOnOpen: false,
  },
);

// Typing a year in a datetime-local input emits parseable intermediate values
// (0026 while aiming for 2026). Dates before 2000 are those or typos, never real.
const MIN_DATE = new Date('2000-01-01T00:00:00');

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(value.getTime()) && value >= MIN_DATE;

const DATE_PATTERN = 'yyyy-MM-dd';
const LOCAL_DATE_PATTERN = 'dd/MM/yyyy';

const isDateOnlyInput = computed(() => props.mode === 'date');
// Safari mobile relies on its native picker, except when the input hides the time the popover still sets.
const isPopoverAvailable = computed(() => true);

// `new Date('yyyy-MM-dd')` is UTC midnight, the previous day in negative-offset timezones.
const parseInput = ({ value }: { value: string }) => {
  const date = parse(value, props.showWeekday ? LOCAL_DATE_PATTERN : DATE_PATTERN, new Date());
  if (props.mode === 'date' || !props.modelValue) return date;
  return set(props.modelValue, { year: getYear(date), month: getMonth(date), date: getDate(date) });
};

const nativeMax = computed(() => {
  const maxDate = props.calendarOptions?.maxDate;
  return maxDate ? format(maxDate, DATE_PATTERN) : '9999-12-31';
});
const nativeMin = computed(() => {
  const minDate = props.calendarOptions?.minDate;
  return minDate ? format(minDate, DATE_PATTERN) : undefined;
});

const toDisplayInput = (date: Date) => format(date, props.showWeekday ? LOCAL_DATE_PATTERN : DATE_PATTERN);
const inputValue = ref(props.modelValue ? toDisplayInput(props.modelValue) : '');

const emit = defineEmits<{
  (e: 'update:modelValue', payload: Date): void;
  (e: 'clear'): void;
}>();
const localValue = ref<Date | null>(props.modelValue ?? (props.clearable ? null : new Date()));
const isPopoverOpen = ref(false);
const calendarPageKey = ref(0);
const timeInputId = useId();
const timeZoneLabel = computed(() =>
  getLocalTimeZoneLabel(isPopoverOpen.value ? (localValue.value ?? undefined) : props.modelValue),
);
const clock = ref(new Date());
const visibility = useDocumentVisibility();
const { resume, pause } = useIntervalFn(() => (clock.value = new Date()), 30000, {
  immediate: false,
  immediateCallback: true,
});
watch(
  () =>
    visibility.value === 'visible' &&
    (isPopoverOpen.value || (!props.hideInputTime && props.mode === 'dateTime' && !props.liveOnOpen)),
  (enabled) => (enabled ? resume() : pause()),
  { immediate: true },
);
const friendlyWeekday = computed(() =>
  props.modelValue ? format(props.modelValue, 'EEEE', { locale: getDateFnsLocale() }) : '',
);
const isSameMinute = (date: Date | null | undefined, time: string, now: Date) =>
  Boolean(date) &&
  date!.getFullYear() === now.getFullYear() &&
  date!.getMonth() === now.getMonth() &&
  date!.getDate() === now.getDate() &&
  time === format(now, 'HH:mm');
const isNowInField = computed(() => isSameMinute(props.modelValue, timeValue.value, clock.value));

const timeValue = ref(props.modelValue ? format(props.modelValue, 'HH:mm') : '');
const dialogTimeValue = ref(props.modelValue ? format(props.modelValue, 'HH:mm') : format(new Date(), 'HH:mm'));
const todayLabel = computed(() => format(clock.value, 'EEEE, d MMMM yyyy', { locale: getDateFnsLocale() }));
const parsedTime = (text: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return null;
  const [hours, minutes] = text.split(':').map(Number);
  return { hours: hours!, minutes: minutes! };
};
const dialogInitial = ref<Date | null>(null);
const dialogReferenceNow = ref(new Date());
const matchesDialogDate = (reference: Date | null) =>
  Boolean(
    reference &&
    localValue.value &&
    (props.mode === 'date'
      ? +startOfDay(localValue.value) === +startOfDay(reference)
      : isSameMinute(localValue.value, dialogTimeValue.value, reference)),
  );
const dialogChanged = computed(() => !matchesDialogDate(dialogInitial.value));
const showDialogNow = computed(
  () => isWithinCalendarBounds(dialogReferenceNow.value) && !matchesDialogDate(dialogReferenceNow.value),
);
const dialogTimeError = computed(() => props.mode !== 'date' && !parsedTime(dialogTimeValue.value));
const isTouchPointer = useMediaQuery('(pointer: coarse)');
const nativeTimeUnavailable = ref(false);
const nativeTimeInput = ref<HTMLInputElement | null>(null);
const typedTimeInput = ref<HTMLInputElement | null>(null);
const usesNativeTime = computed(
  () =>
    isTouchPointer.value && !nativeTimeUnavailable.value && typeof HTMLInputElement.prototype.showPicker === 'function',
);

function showNativeTimePicker() {
  try {
    nativeTimeInput.value?.showPicker();
  } catch {
    // Embedded browsers can expose showPicker but reject opening the OS surface.
    nativeTimeUnavailable.value = true;
    void nextTick(() => typedTimeInput.value?.focus());
  }
}

const isWithinCalendarBounds = (value: Date | null) => {
  if (!isValidDate(value)) return false;
  const day = +startOfDay(value);
  const { minDate, maxDate } = props.calendarOptions ?? {};
  return (!minDate || day >= +startOfDay(minDate)) && (!maxDate || day <= +startOfDay(maxDate));
};
function readTypedTime(event: Event): string {
  const input = event.target as HTMLInputElement;
  const digits = input.value.replace(/\D/g, '').slice(0, 4);
  const value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  if (input.value !== value) input.value = value;
  return value;
}
const handleTimeTyping = (event: Event) => {
  timeValue.value = readTypedTime(event);
};
const handleDialogTimeTyping = (event: Event) => {
  dialogTimeValue.value = usesNativeTime.value ? (event.target as HTMLInputElement).value : readTypedTime(event);
};
const commitTimeInput = () => {
  const nextTime = parsedTime(timeValue.value);
  if (isPopoverOpen.value) return;
  if (nextTime) {
    const base = props.modelValue ?? new Date();
    if (props.modelValue && timeValue.value === format(base, 'HH:mm')) return;
    emit('update:modelValue', set(base, { ...nextTime, seconds: 0, milliseconds: 0 }));
  } else timeValue.value = props.modelValue ? format(props.modelValue, 'HH:mm') : '';
};
const applyNow = () => emit('update:modelValue', new Date());
const setDialogNow = () => {
  const now = new Date();
  localValue.value = now;
  dialogReferenceNow.value = now;
  dialogTimeValue.value = format(now, 'HH:mm');
  draftClock = now;
  // Force the calendar viewport back to the current month/year, not just the
  // selected date when the user had browsed elsewhere.
  calendarPageKey.value += 1;
};
let draftClock = new Date();
const saveDialogDate = () => {
  const date = localValue.value;
  if (!date || !dialogChanged.value || !isWithinCalendarBounds(date) || dialogTimeError.value) return;
  const time = props.mode === 'date' ? { hours: 0, minutes: 0 } : parsedTime(dialogTimeValue.value);
  if (!time) return;
  const seconds =
    props.mode === 'dateTime' && dialogTimeValue.value === format(draftClock, 'HH:mm') ? draftClock.getSeconds() : 0;
  emit('update:modelValue', set(date, { ...time, seconds, milliseconds: 0 }));
  isPopoverOpen.value = false;
};
watch(isPopoverOpen, (open) => {
  if (!open) return;
  const selected = props.liveOnOpen ? new Date() : (props.modelValue ?? new Date());
  dialogInitial.value = props.liveOnOpen ? selected : (props.modelValue ?? null);
  dialogReferenceNow.value = new Date();
  localValue.value = selected;
  draftClock = selected;
  dialogTimeValue.value = format(selected, 'HH:mm');
});

defineExpose({
  open: () => {
    if (isPopoverAvailable.value) isPopoverOpen.value = true;
  },
});

const handleLocalInputUpdate = (event: Event) => {
  const inputVal = (event.target as HTMLInputElement).value;

  // Always update the displayed input value so user can see what they're typing
  inputValue.value = inputVal;

  // Only emit the date if it's a valid date string
  const date = inputVal ? parseInput({ value: inputVal }) : null;
  if (!isPopoverOpen.value && date && isWithinCalendarBounds(date) && date.getTime() !== props.modelValue?.getTime()) {
    emit('update:modelValue', date);
  }
  // For invalid intermediate states, don't emit anything
  // This prevents validation errors during typing
};

const handleBlur = (event: Event) => {
  if (isPopoverOpen.value) return;
  const inputVal = (event.target as HTMLInputElement).value;

  // On blur, validate the final input value
  const date = inputVal ? parseInput({ value: inputVal }) : null;
  if (date && isWithinCalendarBounds(date)) {
    if (date.getTime() !== props.modelValue?.getTime()) emit('update:modelValue', date);
  } else if (inputVal) {
    // Invalid date - revert to last valid value
    inputValue.value = props.modelValue ? toDisplayInput(props.modelValue) : '';
  }
  // If empty, keep it empty
};

const isCleared = () => props.clearable && !props.modelValue;

watch(
  () => [props.modelValue, isDateOnlyInput.value] as const,
  ([value]) => {
    inputValue.value = value ? toDisplayInput(value) : '';
    timeValue.value = value ? format(value, 'HH:mm') : '';
    if (isValidDate(value) && !isPopoverOpen.value) localValue.value = value;
    else if (isCleared() && !isPopoverOpen.value) localValue.value = null;
  },
);

watch(localValue, (value, previousValue) => {
  // A second click may clear v-calendar; keep the draft until Save is pressed.
  if (!isValidDate(value)) {
    localValue.value = isValidDate(previousValue) ? previousValue : (props.modelValue ?? new Date());
  }
});
</script>
