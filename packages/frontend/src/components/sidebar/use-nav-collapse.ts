import { createSharedComposable, useLocalStorage } from '@vueuse/core';
import { computed } from 'vue';

type NavSection = 'accounts' | 'transactions' | 'planned';

export const useSidebarNavCollapse = createSharedComposable(() => {
  const legacy = useLocalStorage<NavSection | null>('sidebar:nav-open-section', null);
  const openSections = useLocalStorage<NavSection[]>('sidebar:nav-open-sections', legacy.value ? [legacy.value] : []);

  const sectionOpen = (section: NavSection) =>
    computed<boolean>({
      get: () => openSections.value.includes(section),
      set: (val) => {
        const remaining = openSections.value.filter((item) => item !== section);
        openSections.value = val ? [...remaining, section] : remaining;
      },
    });

  return {
    isAccountsOpen: sectionOpen('accounts'),
    isTransactionsOpen: sectionOpen('transactions'),
    isPlannedOpen: sectionOpen('planned'),
    hasAnyOpen: computed(() => openSections.value.length > 0),
    collapseAll: () => {
      openSections.value = [];
    },
  };
});
