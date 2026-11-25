import { createSharedComposable } from '@vueuse/core';
import { computed, ref } from 'vue';

type NavSection = 'accounts' | 'transactions' | 'planned';

export const useSidebarNavCollapse = createSharedComposable(() => {
  const openSections = ref<NavSection[]>([]);

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
    resetToActive: ({ section }: { section?: NavSection }) => {
      openSections.value = section ? [section] : [];
    },
    collapseAll: () => {
      openSections.value = [];
    },
  };
});
