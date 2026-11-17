<script lang="ts" setup>
import { type Period } from '@/composable/use-period-navigation';
import { cn } from '@/lib/utils';
import { useI18n } from 'vue-i18n';

import { type DateSelectorPreset } from './types';

const props = defineProps<{
  presets: DateSelectorPreset[];
  currentPeriod: Period;
  horizontal?: boolean;
}>();

const emit = defineEmits<{
  apply: [value: Period];
}>();

const { t } = useI18n();

function isPresetActive(preset: DateSelectorPreset): boolean {
  const presetValue = preset.getValue();
  return (
    props.currentPeriod.from.getTime() === presetValue.from.getTime() &&
    props.currentPeriod.to.getTime() === presetValue.to.getTime()
  );
}
</script>

<template>
  <div
    :class="cn(horizontal ? 'grid w-full min-w-0 gap-1' : 'flex flex-col gap-1')"
    :style="horizontal ? { gridTemplateColumns: `repeat(${presets.length}, minmax(0, 1fr))` } : undefined"
  >
    <div v-if="!horizontal" class="text-muted-foreground mb-1 text-xs font-semibold">
      {{ t('common.dateSelector.quickSelect') }}
    </div>
    <button
      v-for="preset in presets"
      :key="preset.label"
      type="button"
      :class="
        cn(
          'text-muted-foreground hover:bg-accent hover:text-foreground min-w-0 rounded-md px-1 py-2 text-sm transition-colors',
          horizontal ? 'text-center text-[clamp(11px,2.5vw,12px)] leading-tight whitespace-normal' : 'text-left',
          isPresetActive(preset) && 'bg-accent text-foreground font-medium',
        )
      "
      :title="preset.label"
      :aria-label="preset.label"
      @click="emit('apply', preset.getValue())"
    >
      {{ horizontal && preset.shortLabel ? preset.shortLabel : preset.label }}
    </button>
  </div>
</template>
