import { useAiSettings } from '@/composable/data-queries/ai-settings';
import { useUserStore } from '@/stores';
import { type AI_FEATURE, getAiFeatureEntitlement } from '@bt/shared/types';
import { computed } from 'vue';

export const useOptimizationAiBlocker = ({ feature }: { feature: AI_FEATURE }) => {
  const { aiAllowance, featuresUnknown, getFeatureStatus, isFeaturesPending } = useAiSettings();
  const userStore = useUserStore();

  return computed(() => {
    if (featuresUnknown.value) return 'unknown';
    if (isFeaturesPending.value) return 'loading';
    const status = getFeatureStatus(feature);
    if (aiAllowance.value?.state === 'reached' && !status?.usingUserKey) return 'allowance';
    if (status?.servedBy && status.modelId) return null;
    if (status?.connectionId) return 'unavailable';
    if (userStore.isFeatureGated(getAiFeatureEntitlement({ feature }))) return 'access';
    return 'setup';
  });
};
