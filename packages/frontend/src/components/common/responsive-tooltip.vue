<script lang="ts" setup>
import { CHART_TOOLTIP_SIZING_CLASS, CHART_TOOLTIP_SURFACE_CLASS } from '@/components/common/charts/chart-tooltip';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import * as Popover from '@/components/lib/ui/popover';
import * as Tooltip from '@/components/lib/ui/tooltip';
import { cn } from '@/lib/utils';
import { createReusableTemplate, useMediaQuery } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

defineOptions({ inheritAttrs: false });

const [UseTemplate, SlotContent] = createReusableTemplate();
// Detect touch-primary devices (coarse pointer = finger/stylus)
const isTouch = useMediaQuery('(pointer: coarse)');
const { locale } = useI18n();

const props = withDefaults(
  defineProps<{
    content?: string;
    contentClassName?: string;
    delayDuration?: number;
    disabled?: boolean;
    /** `chart` swaps the popover surface for the shared chart-tooltip one, for data readouts. */
    variant?: 'default' | 'chart';
    /** Explanatory question-mark triggers open on click; decorative hover tooltips remain hover-only. */
    interaction?: 'hover' | 'click';
  }>(),
  { delayDuration: 850, variant: 'default' },
);

const contentClass = computed(() =>
  cn(props.variant === 'chart' && [CHART_TOOLTIP_SURFACE_CLASS, CHART_TOOLTIP_SIZING_CLASS], props.contentClassName),
);

// `disabled` closes the tooltip instead of unmounting it, so a focused trigger keeps focus.
const open = ref(false);
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false;
  },
);
</script>

<template>
  <UseTemplate>
    <slot name="content">
      {{ content }}
    </slot>
  </UseTemplate>

  <!-- Explicit help action: a click dialog, shared with HintIcon. -->
  <template v-if="interaction === 'click'">
    <ResponsiveDialog v-model:open="open" :dismissible="!disabled">
      <template #trigger>
        <slot />
      </template>
      <template #title>{{ locale.startsWith('id') ? 'Penjelasan' : 'More information' }}</template>
      <template #description>{{
        locale.startsWith('id') ? 'Informasi tambahan tentang fitur ini.' : 'Additional information about this feature.'
      }}</template>
      <div class="border-border bg-muted/30 text-foreground rounded-xl border p-4 text-sm leading-relaxed">
        <SlotContent />
      </div>
    </ResponsiveDialog>
  </template>

  <!-- Touch devices: Popover (tap to open) -->
  <template v-else-if="isTouch">
    <Popover.Popover :open="open" @update:open="(value) => (open = value && !disabled)">
      <Popover.PopoverTrigger as-child :class="$attrs.class">
        <slot />
      </Popover.PopoverTrigger>

      <Popover.PopoverContent :class="cn('w-max max-w-62.5 p-2 text-sm', contentClass)">
        <SlotContent />
      </Popover.PopoverContent>
    </Popover.Popover>
  </template>

  <!-- Non-touch devices: Tooltip (hover to show) -->
  <template v-else>
    <Tooltip.TooltipProvider :delay-duration="delayDuration">
      <Tooltip.Tooltip v-model:open="open" :disabled="disabled">
        <Tooltip.TooltipTrigger as-child :class="$attrs.class">
          <slot />
        </Tooltip.TooltipTrigger>

        <Tooltip.TooltipContent :class="contentClass">
          <SlotContent />
        </Tooltip.TooltipContent>
      </Tooltip.Tooltip>
    </Tooltip.TooltipProvider>
  </template>
</template>
