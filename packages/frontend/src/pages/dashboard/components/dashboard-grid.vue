<script lang="ts" setup>
import { LayoutGridIcon } from '@lucide/vue';
import { provide, ref, watch } from 'vue';
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

provide('dashboard-save-widget-config', saveWidgetConfigDirect);

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

    <!-- Edit mode: draggable grid -->
    <VueDraggable
      v-else-if="isEditMode"
      v-model="draftWidgets"
      handle=".drag-handle"
      :animation="200"
      :class="[GRID_CLASSES, 'kasana-dashboard-edit-enter']"
    >
      <DashboardWidgetSlot
        v-for="widget in draftWidgets"
        :key="widget.widgetId"
        :widget-config="widget"
        :is-edit-mode="true"
        :can-remove="draftWidgets.length > 1"
        :current-period="currentPeriod"
        @remove="(widgetId) => removeWidget({ widgetId })"
        @resize="(widgetId, colSpan, rowSpan) => resizeWidget({ widgetId, colSpan, rowSpan })"
        @config-change="(widgetId, key, value) => updateWidgetConfig({ widgetId, key, value })"
      />
    </VueDraggable>

    <!-- Normal mode: static grid -->
    <div v-else :class="[GRID_CLASSES, 'kasana-dashboard-edit-return']">
      <DashboardWidgetSlot
        v-for="widget in activeWidgets"
        :key="widget.widgetId"
        :widget-config="widget"
        :is-edit-mode="false"
        :can-remove="false"
        :current-period="currentPeriod"
      />
    </div>

    <div v-if="isEditMode" class="mt-6">
      <DashboardAddWidgetPanel :available-widgets="availableWidgets" @add="(id) => addWidget({ widgetId: id })" />
    </div>
  </div>
</template>
