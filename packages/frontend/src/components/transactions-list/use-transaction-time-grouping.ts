import { useUserSettings } from '@/composable/data-queries/user-settings';
import type { TransactionTimeGrouping } from '@bt/shared/types';
import { computed, ref } from 'vue';

export function useTransactionTimeGrouping() {
  const { data, patchAsync } = useUserSettings();
  const localMode = ref<TransactionTimeGrouping>();
  const mode = computed(() => localMode.value ?? data.value?.ui?.transactionsList?.timeGrouping ?? 'none');
  let save = Promise.resolve();
  let revision = 0;

  const setMode = (value: TransactionTimeGrouping) => {
    if (value === mode.value) return;
    localMode.value = value;
    const currentRevision = ++revision;
    // Keep PATCH order consistent when switching rapidly, without gating the UI.
    save = save.then(async () => {
      if (currentRevision !== revision) return;
      try {
        await patchAsync({ ui: { transactionsList: { timeGrouping: value } } });
      } catch {
        // The shared settings mutation surfaces the error and reloads the saved value.
      } finally {
        if (currentRevision === revision) localMode.value = undefined;
      }
    });
  };

  return { mode, setMode };
}
