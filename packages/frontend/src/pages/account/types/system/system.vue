<script setup lang="ts">
import DetailTabs from '@/components/common/detail-tabs.vue';
import { SCROLL_AREA_IDS } from '@/components/lib/ui/scroll-area/types';
import { useAccountAccess } from '@/composable/use-account-access';
import { Separator } from '@/components/lib/ui/separator';
import * as Tabs from '@/components/lib/ui/tabs';
import AccountArchiveSection from '@/pages/account/components/account-archive-section.vue';
import AccountDeletionSection from '@/pages/account/components/account-deletion-section.vue';
import AccountDetailsTab from '@/pages/account/components/account-details-tab.vue';
import SettingAccountGroup from '@/pages/account/components/account-group.vue';
import SettingToggleVisibility from '@/pages/account/components/setting-toggle-visibility.vue';
import SharingPanel from '@/pages/account/components/sharing-panel/sharing-panel.vue';
import { AccountModel, SHARE_PERMISSIONS } from '@bt/shared/types';
import { computed, ref, toRef, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  account: AccountModel;
}>();

const { isOwner, permission } = useAccountAccess(toRef(() => props.account));
const canSeeSharingTab = computed(() => isOwner.value || permission.value === SHARE_PERMISSIONS.manage);

const slots = useSlots();
const activeTab = ref('details');
const tabItems = computed(() => {
  const items = [{ value: 'details', label: t('pages.account.tabs.details') }];
  if (slots.history) items.splice(1, 0, { value: 'records', label: t('pages.account.rightPanel.transactions') });
  if (canSeeSharingTab.value) items.push({ value: 'sharing', label: t('pages.account.tabs.sharing') });
  items.push({ value: 'settings', label: t('pages.account.tabs.settings') });
  return items;
});
</script>

<template>
  <DetailTabs
    v-model="activeTab"
    :values="tabItems.map(({ value }) => value)"
    :scroll-area-id="SCROLL_AREA_IDS.accountTransactions"
  >
    <template #tabs>
      <Tabs.TabsList class="no-scrollbar flex w-full shrink-0 justify-start overflow-x-auto">
        <Tabs.TabsTrigger
          v-for="tab in tabItems"
          :key="tab.value"
          :value="tab.value"
          class="min-h-9 shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
        >
          {{ tab.label }}
        </Tabs.TabsTrigger>
      </Tabs.TabsList>
    </template>

    <AccountDetailsTab tab-name="details" :account="account" />
    <Tabs.TabsContent v-if="$slots.history" value="records">
      <slot name="history" />
    </Tabs.TabsContent>

    <Tabs.TabsContent value="settings">
      <div class="border-border bg-card grid gap-4 rounded-xl border p-4">
        <SettingToggleVisibility :account="account" />

        <Separator />

        <SettingAccountGroup :account="account" />

        <template v-if="isOwner">
          <Separator />

          <AccountArchiveSection :account="account" />

          <AccountDeletionSection :account="account" />
        </template>
      </div>
    </Tabs.TabsContent>

    <Tabs.TabsContent v-if="canSeeSharingTab" value="sharing">
      <div class="border-border bg-card grid gap-4 rounded-xl border p-4">
        <SharingPanel :account="account" />
      </div>
    </Tabs.TabsContent>
  </DetailTabs>
</template>
