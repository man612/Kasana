import type { DashboardWidgetConfig } from '@/api/user-settings';
import { DEFAULT_DASHBOARD_LAYOUT, WIDGET_REGISTRY } from '@/components/widgets/widget-registry';
import { useUserSettings } from '@/composable/data-queries/user-settings';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { trackAnalyticsEvent } from '@/lib/posthog';
import { useUserStore } from '@/stores/user';
import { StorageSerializers, useLocalStorage } from '@vueuse/core';
import { cloneDeep } from 'lodash-es';
import { computed, nextTick, ref, watch } from 'vue';

export function useDashboardLayout() {
  const { data: settings, isPending: isSettingsPending, patchAsync } = useUserSettings();
  const user = useUserStore();

  const cachedLayout = useLocalStorage<DashboardWidgetConfig[] | null>(
    computed(() => `dashboard-layout:user:${user.user?.id ?? 'none'}`),
    null,
    { serializer: StorageSerializers.object },
  );
  const layoutReady = computed(
    () => Boolean(settings.value) || cachedLayout.value !== null || !isSettingsPending.value,
  );

  const isEditMode = ref(false);
  const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
  const draftWidgets = ref<DashboardWidgetConfig[]>([]);

  const activeWidgets = computed<DashboardWidgetConfig[]>(() => {
    const saved = settings.value?.dashboard?.widgets;

    if (settings.value) {
      // Settings loaded — use API data or default
      const layout = saved ?? DEFAULT_DASHBOARD_LAYOUT;
      return layout.filter((w) => w.widgetId in WIDGET_REGISTRY);
    }

    // Still loading — use cached layout for accurate skeletons
    return (cachedLayout.value ?? DEFAULT_DASHBOARD_LAYOUT).filter((w) => w.widgetId in WIDGET_REGISTRY);
  });

  watch(
    activeWidgets,
    (layout) => {
      if (settings.value && user.user) {
        cachedLayout.value = layout;
      }
    },
    { immediate: true },
  );

  const displayWidgets = computed(() => (isEditMode.value ? draftWidgets.value : activeWidgets.value));

  const availableWidgets = computed(() => {
    const currentIds = new Set(draftWidgets.value.map((w) => w.widgetId));
    return Object.values(WIDGET_REGISTRY).filter((def) => !currentIds.has(def.id));
  });

  const enterEditMode = () => {
    draftWidgets.value = cloneDeep(activeWidgets.value);
    isEditMode.value = true;
    trackAnalyticsEvent({ event: 'dashboard_edit_opened' });
  };

  const exitEditMode = ({ resetDraft = false }: { resetDraft?: boolean } = {}) => {
    const exit = () => {
      isEditMode.value = false;
      if (resetDraft) draftWidgets.value = [];
    };
    const reducedMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transitionHost = document as Document & {
      startViewTransition?: (callback: () => Promise<void>) => unknown;
    };
    if (isMobile.value || reducedMotion || typeof transitionHost.startViewTransition !== 'function') {
      exit();
      return;
    }
    // Capture both layouts after Vue paints to avoid abrupt widget flicker.
    transitionHost.startViewTransition(async () => {
      exit();
      await nextTick();
    });
  };

  let saveQueue = Promise.resolve();
  const queueLayoutUpdate = (update: () => Promise<void>) => {
    const owner = user.user?.id;
    const save = saveQueue.then(async () => {
      if (owner === undefined || owner !== user.user?.id) return;
      await update();
    });
    saveQueue = save.catch(() => {});
    return save;
  };

  const saveLayout = () => {
    const widgets = cloneDeep(draftWidgets.value);
    return queueLayoutUpdate(async () => {
      await patchAsync({ dashboard: { widgets } });
      trackAnalyticsEvent({
        event: 'dashboard_layout_saved',
        properties: { widget_count: widgets.length },
      });
      exitEditMode();
    });
  };

  const cancelEdit = () => {
    exitEditMode({ resetDraft: true });
  };

  const removeWidget = ({ widgetId }: { widgetId: string }) => {
    draftWidgets.value = draftWidgets.value.filter((w) => w.widgetId !== widgetId);
  };

  const addWidget = ({ widgetId }: { widgetId: string }) => {
    const def = WIDGET_REGISTRY[widgetId];
    if (!def) return;
    draftWidgets.value.push({ widgetId, colSpan: def.defaultColSpan, rowSpan: def.defaultRowSpan });
  };

  const resizeWidget = ({ widgetId, colSpan, rowSpan }: { widgetId: string; colSpan: number; rowSpan: number }) => {
    const widget = draftWidgets.value.find((w) => w.widgetId === widgetId);
    if (widget) {
      widget.colSpan = colSpan;
      widget.rowSpan = rowSpan;
    }
  };

  const updateWidgetConfig = ({ widgetId, key, value }: { widgetId: string; key: string; value: unknown }) => {
    const widget = draftWidgets.value.find((w) => w.widgetId === widgetId);
    if (widget) {
      widget.config = { ...widget.config, [key]: value };
    }
  };

  const saveWidgetConfigDirect = ({ widgetId, config }: { widgetId: string; config: Record<string, unknown> }) =>
    queueLayoutUpdate(async () => {
      if (!settings.value) return;
      const widgets = cloneDeep(activeWidgets.value);
      const widget = widgets.find((entry) => entry.widgetId === widgetId);
      if (!widget) return;
      widget.config = { ...widget.config, ...config };
      await patchAsync({ dashboard: { widgets } });
      trackAnalyticsEvent({
        event: 'dashboard_widget_config_saved',
        properties: { widget_id: widgetId },
      });
    });

  return {
    isEditMode,
    activeWidgets,
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
  };
}
