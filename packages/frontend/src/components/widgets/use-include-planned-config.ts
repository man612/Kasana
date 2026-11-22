import type { DashboardWidgetConfig } from '@/api/user-settings';
import { useNotificationCenter } from '@/components/notification-center';
import { i18n } from '@/i18n';
import { ApiErrorResponseError } from '@/js/errors';
import { type Ref, computed, inject, ref } from 'vue';

/**
 * For widgets that count pending planned transactions unless their config opts out: a missing
 * key reads as `true`.
 */
export const readIncludePlanned = ({ config }: { config: Record<string, unknown> | undefined }): boolean =>
  config?.includePlanned !== false;

/**
 * A failed save leaves the switch snapped back to the persisted value, which reads as the
 * toggle being ignored unless the failure is surfaced.
 */
const useConfigSaveError = ({ fallbackKey }: { fallbackKey: string }) => {
  const { addErrorNotification } = useNotificationCenter();

  return ({ error }: { error: unknown }) => {
    if (error instanceof ApiErrorResponseError) {
      addErrorNotification(error.data.message ?? error.message);
    } else {
      // eslint-disable-next-line no-console
      console.error(error);
      addErrorNotification(i18n.global.t(fallbackKey));
    }
  };
};

export const useIncludePlannedSaveError = () =>
  useConfigSaveError({ fallbackKey: 'dashboard.widgets.common.includePlannedSaveError' });

/** A missing or non-boolean stored value reads as `defaultValue`. */
export const readWidgetConfigFlag = ({
  config,
  key,
  defaultValue,
}: {
  config: Record<string, unknown> | undefined;
  key: string;
  defaultValue: boolean;
}): boolean => {
  const value = config?.[key];
  return typeof value === 'boolean' ? value : defaultValue;
};

/**
 * Reads and persists one boolean of a dashboard widget's config through the shared
 * widget-config injections.
 */
export const useWidgetConfigFlag = ({
  key,
  saveErrorKey,
  defaultValue = true,
  optimistic = false,
}: {
  key: string;
  saveErrorKey: string;
  defaultValue?: boolean;
  optimistic?: boolean;
}) => {
  const widgetConfigRef = inject<Ref<DashboardWidgetConfig> | null>('dashboard-widget-config', null);
  const saveWidgetConfig =
    inject<(params: { widgetId: string; config: Record<string, unknown> }) => Promise<void>>(
      'dashboard-save-widget-config',
    );

  const notifySaveError = useConfigSaveError({ fallbackKey: saveErrorKey });

  const pending = ref<boolean>();
  let revision = 0;
  const isOn = computed<boolean>(
    () => pending.value ?? readWidgetConfigFlag({ config: widgetConfigRef?.value?.config, key, defaultValue }),
  );

  const setFlag = async ({ value }: { value: boolean }) => {
    if (!saveWidgetConfig || !widgetConfigRef?.value) return;

    const current = ++revision;
    if (optimistic) pending.value = value;
    try {
      await saveWidgetConfig({
        widgetId: widgetConfigRef.value.widgetId,
        config: { [key]: value },
      });
    } catch (error) {
      notifySaveError({ error });
    } finally {
      if (current === revision) pending.value = undefined;
    }
  };

  return { widgetConfigRef, isOn, setFlag };
};

export const useIncludePlannedConfig = ({ defaultValue = true }: { defaultValue?: boolean } = {}) => {
  const { widgetConfigRef, isOn, setFlag } = useWidgetConfigFlag({
    key: 'includePlanned',
    saveErrorKey: 'dashboard.widgets.common.includePlannedSaveError',
    defaultValue,
  });

  return { widgetConfigRef, includePlanned: isOn, setIncludePlanned: setFlag };
};
