import { useUserSettings } from '@/composable/data-queries/user-settings';
import { computed } from 'vue';

const SUPPORT_URL = 'https://github.com/man612/Kasana/issues';

/**
 * Shared read/write access to the header "Support" (donation) button visibility.
 * Used by both the header (to render the button) and the appearance settings
 * page (to toggle it) so the two stay in sync. Cloud users pay a subscription,
 * so the button exists only on self-host; there it defaults to visible.
 */
export const useSupportButton = () => {
  const { data: userSettings, patchAsync, isPatching } = useUserSettings();

  const isSupportButtonAvailable = computed(() => false); // No upstream donation prompt in the local product.

  const isSupportButtonVisible = computed(
    () => isSupportButtonAvailable.value && (userSettings.value?.showSupportButton ?? true),
  );

  const setSupportButtonVisible = (value: boolean) => patchAsync({ showSupportButton: value });

  const openSupport = () => {
    window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
  };

  return {
    isSupportButtonAvailable,
    isSupportButtonVisible,
    setSupportButtonVisible,
    openSupport,
    isUpdating: isPatching,
  };
};
