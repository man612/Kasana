<script lang="ts" setup>
import { PillTabs } from '@/components/lib/ui/pill-tabs';
import { useDateLocale } from '@/composable/use-date-locale';
import { type Period } from '@/composable/use-period-navigation';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { ChevronDownIcon, SlidersHorizontalIcon, X } from '@lucide/vue';
import { endOfDay, endOfMonth, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from '../button/Button.vue';
import DateSelectorDayPanel from './date-selector-day-panel.vue';
import DateSelectorFilterMode from './date-selector-filter-mode.vue';
import DateSelectorFooter from './date-selector-footer.vue';
import DateSelectorPeriodGrid from './date-selector-period-grid.vue';
import DateSelectorPresets from './date-selector-presets.vue';
import { parseDateInput } from './date-selector-utils';
import {
  type DateSelectorFilterMode as DateSelectorFilterModeType,
  type DateSelectorPeriodType,
  type DateSelectorPreset,
} from './types';
import { useDateSelector } from './use-date-selector';

const props = defineProps<{
  period: Period;
  presets?: DateSelectorPreset[];
  earliestDate?: Date;
  allowedFilterModes?: DateSelectorFilterModeType[];
  hideHeader?: boolean;
  hideCancel?: boolean;
}>();

const emit = defineEmits<{
  apply: [value: Period];
  cancel: [];
  presetApply: [value: Period];
}>();

const { t } = useI18n();
const { format } = useDateLocale();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

const {
  activePeriodType,
  activeFilterMode,
  draftDayRange,
  initDraft,
  selectCell,
  getCellState,
  resolvePeriod,
  displayText,
  clearSelection,
  hasSelection,
} = useDateSelector({
  formatFn: format,
  translateFn: t,
  earliestDate: () => props.earliestDate,
});

initDraft({ period: props.period });

// If allowedFilterModes is set and current mode isn't allowed, switch to the first allowed mode
if (props.allowedFilterModes?.length && !props.allowedFilterModes.includes(activeFilterMode.value)) {
  activeFilterMode.value = props.allowedFilterModes[0]!;
}

watch([activePeriodType, activeFilterMode], () => {
  clearSelection();
});

const periodTypeTabs = computed<{ value: DateSelectorPeriodType; label: string }[]>(() => [
  { value: 'day', label: t('common.dateSelector.periodTypes.day') },
  { value: 'month', label: t('common.dateSelector.periodTypes.month') },
  { value: 'quarter', label: t('common.dateSelector.periodTypes.quarter') },
  { value: 'half-year', label: t('common.dateSelector.periodTypes.halfYear') },
  { value: 'year', label: t('common.dateSelector.periodTypes.year') },
]);

// Shared shortcuts when a page has not supplied its own (for example, dashboard
// passes pay-period-aware shortcuts instead of generic calendar months).
const quickPresets = computed<DateSelectorPreset[]>(() =>
  props.presets?.length
    ? props.presets
    : [
        {
          label: t('common.dateSelector.todayQuick'),
          getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
        },
        {
          label: t('common.dateSelector.currentMonthQuick'),
          getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
        },
        {
          label: t('common.dateSelector.previousMonthQuick'),
          getValue: () => {
            const previous = subMonths(new Date(), 1);
            return { from: startOfMonth(previous), to: endOfMonth(previous) };
          },
        },
      ],
);

const YEAR_START = 2000;

const years = computed(() => {
  const currentYear = new Date().getFullYear();
  const count = currentYear - YEAR_START + 1;
  return Array.from({ length: count }, (_, i) => currentYear - i);
});

// Simple first: operators and free-text syntax are available when requested.
const showAdvancedFilters = ref(
  activeFilterMode.value !== 'is' ||
    Boolean(props.allowedFilterModes?.length && !props.allowedFilterModes.includes('is')),
);

const inputValue = ref('');

const placeholderText = computed(() => {
  switch (activePeriodType.value) {
    case 'day':
      return t('common.dateSelector.placeholders.day');
    case 'month':
      return t('common.dateSelector.placeholders.month');
    case 'quarter':
      return t('common.dateSelector.placeholders.quarter');
    case 'half-year':
      return t('common.dateSelector.placeholders.halfYear');
    case 'year':
      return t('common.dateSelector.placeholders.year');
    default:
      return t('common.dateSelector.placeholders.default');
  }
});

function handleInputSubmit() {
  const parsed = parseDateInput({ input: inputValue.value });
  if (!parsed) return;

  activePeriodType.value = parsed.periodType;
  activeFilterMode.value = parsed.filterMode;

  if (parsed.periodType === 'day' && parsed.dayStart && parsed.dayEnd) {
    draftDayRange.value = { start: parsed.dayStart, end: parsed.dayEnd };
  } else {
    selectCell({ year: parsed.start.year, index: parsed.start.index });
  }

  inputValue.value = '';
}

function handleApply() {
  const resolved = resolvePeriod();
  if (resolved) {
    emit('apply', resolved);
  }
}

function handlePresetApply(value: Period) {
  emit('presetApply', value);
}

function handleDayRangeUpdate({ start, end }: { start: Date; end: Date | null }) {
  draftDayRange.value = { start, end };
}

const isDaySingleSelect = computed(() => activePeriodType.value === 'day' && activeFilterMode.value !== 'between');

const numberOfMonths = computed(() => (isMobile.value ? 1 : 2));

function setPeriodType(type: DateSelectorPeriodType) {
  activePeriodType.value = type;
}
</script>

<template>
  <div class="flex max-h-[min(77dvh,710px)] min-h-0 w-full min-w-0 flex-col">
    <div class="lajur-dialog-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-2 pb-3">
      <div v-if="!hideHeader" class="space-y-1">
        <p class="text-sm font-semibold">{{ t('common.dateSelector.simpleTitle') }}</p>
        <p class="text-muted-foreground text-xs leading-relaxed">{{ t('common.dateSelector.simpleHint') }}</p>
      </div>

      <!-- One-tap choices, shared between the dashboard and other date selectors. -->
      <div v-if="quickPresets.length" class="bg-muted/40 space-y-1 rounded-lg border p-2">
        <p class="text-muted-foreground px-2 text-xs font-medium">{{ t('common.dateSelector.quickSelect') }}</p>
        <DateSelectorPresets horizontal :presets="quickPresets" :current-period="period" @apply="handlePresetApply" />
      </div>

      <!-- Keep period granularity visible; uncommon query operators are optional. -->
      <PillTabs
        :items="periodTypeTabs"
        :model-value="activePeriodType"
        size="sm"
        class="whitespace-nowrap"
        @update:model-value="setPeriodType($event as DateSelectorPeriodType)"
      />

      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground h-8 gap-1.5 self-start px-1 text-xs"
        :aria-expanded="showAdvancedFilters"
        @click="showAdvancedFilters = !showAdvancedFilters"
      >
        <SlidersHorizontalIcon class="size-3.5" />
        {{ t('common.dateSelector.advancedOptions') }}
        <ChevronDownIcon
          class="size-3.5 transition-transform duration-200"
          :class="showAdvancedFilters && 'rotate-180'"
        />
      </Button>

      <Transition name="kasana-feedback">
        <div
          v-if="showAdvancedFilters"
          class="border-border bg-muted/30 flex min-w-0 flex-col gap-2 rounded-lg border p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium">{{ t('common.dateSelector.dueDate') }}</span>
            <DateSelectorFilterMode v-model="activeFilterMode" :allowed-modes="allowedFilterModes" />
          </div>
          <input
            v-model="inputValue"
            type="text"
            :placeholder="placeholderText"
            :aria-label="t('common.dateSelector.manualDate')"
            class="border-input bg-input-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-2 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-hidden"
            @keydown.enter="handleInputSubmit"
          />
        </div>
      </Transition>

      <div class="min-w-0">
        <Transition name="kasana-section" mode="out-in">
          <DateSelectorDayPanel
            v-if="activePeriodType === 'day'"
            key="day"
            :start="draftDayRange.start"
            :end="draftDayRange.end"
            :number-of-months="numberOfMonths"
            :single-select="isDaySingleSelect"
            @update:range="handleDayRangeUpdate"
          />
          <DateSelectorPeriodGrid
            v-else
            :key="activePeriodType"
            :period-type="activePeriodType"
            :years="years"
            :get-cell-state="getCellState"
            @select-cell="selectCell"
          />
        </Transition>
      </div>
    </div>

    <DateSelectorFooter
      :apply-disabled="!hasSelection"
      :show-cancel="!hideCancel"
      @cancel="emit('cancel')"
      @apply="handleApply"
    >
      <Button
        v-if="displayText"
        variant="secondary"
        size="sm"
        class="xxs:min-w-30 flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-center text-sm"
        @click="clearSelection"
      >
        <span class="grow truncate">{{ displayText }}</span>
        <span class="ml-auto flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
          <X class="size-3" />
        </span>
      </Button>
    </DateSelectorFooter>
  </div>
</template>
