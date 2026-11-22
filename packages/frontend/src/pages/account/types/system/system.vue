<script setup lang="ts">
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
  <Tabs.Tabs v-model="activeTab">
    <Tabs.TabsList class="mt-3 flex w-full justify-start overflow-x-auto">
      <Tabs.TabsTrigger v-for="tab in tabItems" :key="tab.value" :value="tab.value" class="min-h-9 shrink-0">
        {{ tab.label }}
      </Tabs.TabsTrigger>
    </Tabs.TabsList>

    <AccountDetailsTab tab-name="details" :account="account" />
    <Tabs.TabsContent v-if="$slots.history" value="records">
      <slot name="history" />
    </Tabs.TabsContent>

    <Tabs.TabsContent value="settings">
      <div class="grid gap-4 py-6">
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
      <div class="grid gap-4 py-6">
        <SharingPanel :account="account" />
      </div>
    </Tabs.TabsContent>
  </Tabs.Tabs>
</template>
