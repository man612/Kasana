<script lang="ts" setup>
import { LayoutGridIcon } from '@lucide/vue';
import { computed, nextTick, provide, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { useDashboardLayout } from '../composables/use-dashboard-layout';
import type { Period } from '../types';
import DashboardAddWidgetPanel from './dashboard-add-widget-panel.vue';
import DashboardWidgetSlot from './dashboard-widget-slot.vue';

const props = defineProps<{
  currentPeriod: Period;
}>();

const gridRoot = ref<HTMLElement | null>(null);
// Animate the existing grid instead of remounting widgets on each month change.
// Remounting would discard local widget state and interfere with draggable layouts.
watch(
  () => [props.currentPeriod.from.getTime(), props.currentPeriod.to.getTime()].join(':'),
  () => {
    const element = gridRoot.value;
    if (!element || typeof element.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    element.animate(
      [
        { opacity: 0.74, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 210, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  },
  { flush: 'post' },
);

const {
  isEditMode,
  activeWidgets,
  draftWidgets,
  displayWidgets,
  availableWidgets,
  enterEditMode,
  saveLayout,
  cancelEdit,
  removeWidget,
  addWidget,
  resizeWidget,
  updateWidgetConfig,
  saveWidgetConfigDirect,
} = useDashboardLayout();

// Keep a single widget tree mounted when entering/leaving edit mode. Recreating
// the whole grid made charts and cards flash on every Save/Cancel action.
const editableWidgets = computed({
  get: () => displayWidgets.value,
  set: (value: typeof draftWidgets.value) => {
    if (isEditMode.value) draftWidgets.value = value;
  },
});
provide('dashboard-save-widget-config', saveWidgetConfigDirect);

// Layout size changes are discrete in CSS Grid: View Transitions animate the
// previous and next widget rectangles without remounting charts or changing
// the saved layout. Older browsers use the existing instant layout behavior.
const animateLayoutChange = (change: () => void) => {
  const startViewTransition = (
    document as Document & {
      startViewTransition?: (callback: () => Promise<void>) => unknown;
    }
  ).startViewTransition;
  if (!isEditMode.value || !startViewTransition || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    change();
    return;
  }
  startViewTransition.call(document, async () => {
    change();
    await nextTick();
  });
};
const resizeWidgetAnimated = (widgetId: string, colSpan: number, rowSpan: number) =>
  animateLayoutChange(() => resizeWidget({ widgetId, colSpan, rowSpan }));
const removeWidgetAnimated = (widgetId: string) => animateLayoutChange(() => removeWidget({ widgetId }));
const addWidgetAnimated = (widgetId: string) => animateLayoutChange(() => addWidget({ widgetId }));

defineExpose({
  isEditMode,
  enterEditMode,
  saveLayout,
  cancelEdit,
});

const GRID_CLASSES =
  'grid grid-cols-1 gap-4 md:grid-cols-2 md:[grid-auto-rows:minmax(15rem,auto)] xl:grid-cols-3 [grid-auto-flow:dense]';
</script>

<template>
  <div ref="gridRoot">
    <template v-if="displayWidgets.length === 0">
      <div class="text-muted-foreground flex flex-col items-center justify-center gap-3 py-20">
        <LayoutGridIcon class="size-12 opacity-50" />
        <p class="text-sm">{{ $t('dashboard.editMode.emptyState') }}</p>
      </div>
    </template>

    <!-- One stable DOM tree in both modes: Sortable is disabled outside edit mode.
         This preserves each widget instance and chart state while the overlay animates. -->
    <VueDraggable
      v-else
      v-model="editableWidgets"
      handle=".drag-handle"
      :disabled="!isEditMode"
      :animation="200"
      :class="[GRID_CLASSES, isEditMode ? 'kasana-dashboard-edit-enter' : 'kasana-dashboard-edit-return']"
    >
      <DashboardWidgetSlot
        v-for="widget in displayWidgets"
        :key="widget.widgetId"
        :widget-config="widget"
        :is-edit-mode="isEditMode"
        :can-remove="isEditMode && draftWidgets.length > 1"
        :current-period="currentPeriod"
        @remove="removeWidgetAnimated"
        @resize="resizeWidgetAnimated"
        @config-change="(widgetId, key, value) => updateWidgetConfig({ widgetId, key, value })"
      />
    </VueDraggable>

    <div v-if="isEditMode" class="mt-6">
      <DashboardAddWidgetPanel :available-widgets="availableWidgets" @add="addWidgetAnimated" />
    </div>
  </div>
</template>
