import { useBaseCurrencyChangeStatus } from '@/composable/use-base-currency-change-status';
import { useImportBatchDeleteJobStatus } from '@/composable/use-import-batch-delete-job-status';
import { useRestoreJobStatus } from '@/composable/use-restore-job-status';
import { captureException } from '@/lib/sentry';
import { useAuthStore } from '@/stores/auth';
import { useCategoriesStore } from '@/stores/categories/categories';
import { useCurrenciesStore } from '@/stores/currencies';
import { useUserStore } from '@/stores/user';
import { defineStore, storeToRefs } from 'pinia';
import { ref } from 'vue';

export const useRootStore = defineStore('root', () => {
  const authStore = useAuthStore();
  const currenciesStore = useCurrenciesStore();
  const userStore = useUserStore();
  const categoriesStore = useCategoriesStore();

  const isAppInitialized = ref(false);
  const initializationFailed = ref(false);

  const { isLoggedIn } = storeToRefs(authStore);
  const { user } = storeToRefs(userStore);
  const { isFetched: categoriesFetched } = storeToRefs(categoriesStore);
  const { isBaseCurrencyExists } = storeToRefs(currenciesStore);

  const fetchInitialData = async () => {
    if (isLoggedIn.value) {
      isAppInitialized.value = false;
      initializationFailed.value = false;

      try {
        if (!user.value) await userStore.loadUser();

        await Promise.all([
          ...(categoriesFetched.value ? [] : [categoriesStore.loadCategories()]),
          currenciesStore.loadCurrencies(),
          ...(isBaseCurrencyExists.value ? [] : [currenciesStore.loadBaseCurrency()]),
          useBaseCurrencyChangeStatus().checkOnBoot(),
          useRestoreJobStatus().checkOnBoot(),
          useImportBatchDeleteJobStatus().checkOnBoot(),
        ]);

        isAppInitialized.value = true;
      } catch (error) {
        initializationFailed.value = true;
        captureException({ error, context: { scope: 'app-initialization' } });
      }
    }
  };

  return {
    fetchInitialData,

    isAppInitialized,
    initializationFailed,
  };
});
