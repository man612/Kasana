<template>
  <div
    :class="{
      'date-field--error': errorMessage,
      'date-field--disabled': disabled,
    }"
    class="relative w-full flex-1"
  >
    <Dialog.Dialog v-model:open="isPopoverOpen">
      <FieldLabel :label="label" :only-template="Boolean($slots['label-right'])">
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
                class="border-input bg-input-background focus-visible:ring-ring h-10 w-full rounded-md border py-2 pr-36 pl-3 text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-9"
                @input="handleLocalInputUpdate"
                @blur="handleBlur"
                @keydown.enter.prevent="handleBlur($event)"
              />
              <span
                v-if="friendlyWeekday"
                aria-hidden="true"
                class="text-muted-foreground pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 truncate text-xs"
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
          <div v-if="!isDateOnlyInput" class="flex shrink-0 items-center gap-1">
            <input
              :value="timeValue"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              maxlength="5"
              placeholder="HH:mm"
              aria-label="Jam dan menit (format 24 jam)"
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
        <FieldError :error-message="errorMessage" />
        <Dialog.DialogContent
          blur-overlay
          class="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-105 gap-3 overflow-x-hidden overflow-y-auto p-4 sm:p-5"
          data-testid="transaction-date-dialog"
        >
          <Dialog.DialogTitle class="pr-12 text-base font-semibold">
            {{ i18n.global.t('common.dateSelector.dateTimeTitle') }}
          </Dialog.DialogTitle>
          <Dialog.DialogDescription class="text-muted-foreground pr-12 text-xs leading-relaxed">
            {{ i18n.global.t('common.dateSelector.dateTimeHint') }}
          </Dialog.DialogDescription>
          <div class="flex min-w-0 justify-center">
            <Calendar :key="calendarPageKey" v-model="localValue" v-bind="calendarOptions" mode="date" type="single" />
          </div>
          <div class="border-border grid gap-3 border-t pt-3">
            <div class="text-muted-foreground flex items-center gap-2 text-xs">
              <span class="size-2 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
              {{ i18n.global.t('common.dateSelector.todayIndicator') }}: {{ todayLabel }}
            </div>
            <div v-if="mode !== 'date'" class="flex items-center justify-between gap-3">
              <label for="lajur-popup-time" class="text-sm font-medium">
                {{ i18n.global.t('common.dateSelector.timeLabel') }} ({{ timeZoneLabel }})
              </label>
              <input
                id="lajur-popup-time"
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
            <div class="flex min-h-9 flex-wrap items-center justify-end gap-2">
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
              >
                <Button
                  v-if="!isDialogNow"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="text-muted-foreground mr-auto px-2"
                  data-testid="date-dialog-now"
                  @click="setDialogNow"
                >
                  <Clock3Icon class="mr-1.5 size-3.5" />
                  {{ i18n.global.t('common.dateSelector.nowQuick') }}
                </Button>
              </Transition>
              <div class="ml-auto flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  data-testid="date-dialog-save"
                  :disabled="dialogTimeError"
                  @click="saveDialogDate"
                >
                  {{ i18n.global.t('common.dateSelector.saveDate') }}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.DialogContent>
      </FieldLabel>
    </Dialog.Dialog>
  </div>
</template>

<script setup lang="ts">
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import { Button } from '@/components/lib/ui/button';
import { Calendar } from '@/components/lib/ui/calendar';
import * as Dialog from '@/components/lib/ui/dialog';
import { i18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { format, getDate, getMonth, getYear, parse, set } from 'date-fns';
import { CalendarClockIcon, Clock3Icon, XIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { useNow } from '@vueuse/core';
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
const timeZoneLabel = getLocalTimeZoneLabel();
const clock = useNow({ interval: 30000 });
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
const isDialogNow = computed(() => isSameMinute(localValue.value, dialogTimeValue.value, clock.value));

const timeValue = ref(props.modelValue ? format(props.modelValue, 'HH:mm') : '');
const dialogTimeValue = ref(props.modelValue ? format(props.modelValue, 'HH:mm') : format(new Date(), 'HH:mm'));
const todayLabel = computed(() => format(clock.value, 'EEEE, d MMMM yyyy', { locale: getDateFnsLocale() }));
const parsedTime = (text: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return null;
  const [hours, minutes] = text.split(':').map(Number);
  return { hours: hours!, minutes: minutes! };
};
const dialogTimeError = computed(() => props.mode !== 'date' && !parsedTime(dialogTimeValue.value));
const handleTimeTyping = (event: Event) => {
  timeValue.value = (event.target as HTMLInputElement).value;
};
const handleDialogTimeTyping = (event: Event) => {
  dialogTimeValue.value = (event.target as HTMLInputElement).value;
};
const commitTimeInput = () => {
  const nextTime = parsedTime(timeValue.value);
  if (nextTime) {
    const base = props.modelValue ?? new Date();
    emit('update:modelValue', set(base, { ...nextTime, seconds: 0, milliseconds: 0 }));
  } else timeValue.value = props.modelValue ? format(props.modelValue, 'HH:mm') : '';
};
const applyNow = () => emit('update:modelValue', new Date());
const setDialogNow = () => {
  const now = new Date();
  localValue.value = now;
  dialogTimeValue.value = format(now, 'HH:mm');
  // Force the calendar viewport back to the current month/year, not just the
  // selected date when the user had browsed elsewhere.
  calendarPageKey.value += 1;
};
const saveDialogDate = () => {
  if (!isValidDate(localValue.value) || dialogTimeError.value) return;
  const date = localValue.value;
  const time = props.mode === 'date' ? { hours: 0, minutes: 0 } : parsedTime(dialogTimeValue.value);
  if (!time) return;
  emit('update:modelValue', set(date, { ...time, seconds: 0, milliseconds: 0 }));
  isPopoverOpen.value = false;
};
watch(isPopoverOpen, (open) => {
  if (!open) return;
  localValue.value = props.modelValue ?? new Date();
  dialogTimeValue.value = format(props.modelValue ?? new Date(), 'HH:mm');
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
  if (inputVal && isValidDate(parseInput({ value: inputVal }))) {
    emit('update:modelValue', parseInput({ value: inputVal }));
  }
  // For invalid intermediate states, don't emit anything
  // This prevents validation errors during typing
};

const handleBlur = (event: Event) => {
  const inputVal = (event.target as HTMLInputElement).value;

  // On blur, validate the final input value
  if (inputVal && isValidDate(parseInput({ value: inputVal }))) {
    // Valid date - emit it
    emit('update:modelValue', parseInput({ value: inputVal }));
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
