import { loadSystemCategories } from '@/api';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { type FormattedCategory } from '@/common/types';
import { useNotificationCenter } from '@/components/notification-center';
import { userSettingsQueryOptions } from '@/composable/data-queries/user-settings';
import { i18n } from '@/i18n';
import * as errors from '@/js/errors';
import { invalidatePersistedQuery, queryClient } from '@/lib/query-client';
import { useUserStore } from '@/stores/user';
import { CategoryModel } from '@bt/shared/types';
import { hashKey, useQuery } from '@tanstack/vue-query';
import { defineStore, storeToRefs } from 'pinia';
import { computed, onScopeDispose, ref } from 'vue';

import { buildCategoriesObjectGraph } from './helpers';

export const useCategoriesStore = defineStore('categories', () => {
  const notificationStore = useNotificationCenter();
  const { user: currentUser } = storeToRefs(useUserStore());

  // Union of the caller's own categories and those of every account-owner they can read,
  // so display lookups can resolve ids belonging to a shared account.
  const categoryQuery = {
    queryKey: VUE_QUERY_CACHE_KEYS.categoriesList,
    queryFn: loadSystemCategories,
  };
  const categories = ref<CategoryModel[]>([]);
  const isFetched = ref(false);
  const categoryHash = hashKey(categoryQuery.queryKey);

  onScopeDispose(
    queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryHash !== categoryHash) return;
      if (event.type === 'removed') {
        categories.value = [];
        isFetched.value = false;
      } else if (event.query.state.data !== undefined) {
        categories.value = event.query.state.data as CategoryModel[];
        isFetched.value = true;
      }
    }),
  );

  // Never `ensureQueryData` here: it short-circuits on present data and would hand back
  // the entry `force` just invalidated, making the flag inert.
  const loadCategories = async ({ force = false }: { force?: boolean } = {}) => {
    try {
      if (force) {
        await invalidatePersistedQuery({ queryKey: VUE_QUERY_CACHE_KEYS.categoriesList });
      }

      categories.value = await queryClient.fetchQuery(categoryQuery);
      isFetched.value = true;
    } catch (err) {
      if (!(err instanceof errors.AuthError)) {
        notificationStore.addErrorNotification(i18n.global.t('settings.categories.errors.cannotLoad'));
      }
    }
  };

  // Narrows to the caller's own categories, keeping another owner's tree out of the
  // category picker.
  const ownCategories = computed<CategoryModel[]>(() => {
    const callerUserId = currentUser.value?.id;
    if (callerUserId == null) return categories.value;
    return categories.value.filter((c) => c.userId === callerUserId);
  });

  const { data: userSettings } = useQuery(
    { ...userSettingsQueryOptions, enabled: computed(() => !!currentUser.value) },
    queryClient,
  );
  const categoryOrder = computed(() => userSettings.value?.categoryOrder ?? {});

  const formattedCategories = computed<FormattedCategory[]>(() =>
    buildCategoriesObjectGraph({ items: ownCategories.value, order: categoryOrder.value }),
  );
  const categoriesMap = computed(() =>
    categories.value.reduce(
      (acc, curr) => {
        acc[curr.id] = curr;
        return acc;
      },
      {} as Record<string, CategoryModel>,
    ),
  );

  return {
    categories,
    categoriesMap,
    categoryOrder,
    isFetched,
    ownCategories,
    formattedCategories,
    loadCategories,
  };
});
