<script lang="ts" setup>
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { LayoutGridIcon } from '@lucide/vue';
import { computed, nextTick, provide } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { useDashboardLayout } from '../composables/use-dashboard-layout';
import type { Period } from '../types';
import DashboardAddWidgetPanel from './dashboard-add-widget-panel.vue';
import DashboardWidgetSlot from './dashboard-widget-slot.vue';

const props = defineProps<{
  currentPeriod: Period;
}>();

const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
const {
  isEditMode,
  layoutReady,
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
  if (!startViewTransition || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
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
  enterEditMode: () => layoutReady.value && (isMobile.value ? enterEditMode() : animateLayoutChange(enterEditMode)),
  saveLayout,
  cancelEdit,
});

const GRID_CLASSES =
  'grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 md:[grid-auto-rows:minmax(15rem,auto)] xl:grid-cols-3 [grid-auto-flow:dense]';
</script>

<template>
  <div>
    <div v-if="!layoutReady" :class="GRID_CLASSES" aria-busy="true">
      <div v-for="index in 3" :key="index" class="bg-muted/60 h-64 rounded-xl border motion-safe:animate-pulse" />
    </div>
    <template v-else-if="displayWidgets.length === 0">
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
      :class="[
        GRID_CLASSES,
        !isMobile && (isEditMode ? 'kasana-dashboard-edit-enter' : 'kasana-dashboard-edit-return'),
      ]"
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

    <Transition name="lajur-form-panel">
      <div v-if="isEditMode" class="mt-6">
        <DashboardAddWidgetPanel :available-widgets="availableWidgets" @add="addWidgetAnimated" />
      </div>
    </Transition>
  </div>
</template>
