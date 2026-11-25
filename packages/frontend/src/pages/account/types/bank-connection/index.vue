<script setup lang="ts">
import DetailTabs from '@/components/common/detail-tabs.vue';
import { SCROLL_AREA_IDS } from '@/components/lib/ui/scroll-area/types';
import { type BankConnection, listConnections } from '@/api/bank-data-providers';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import BankProviderLogo from '@/components/common/bank-providers/bank-provider-logo.vue';
import { Callout } from '@/components/lib/ui/callout';
import { Separator } from '@/components/lib/ui/separator';
import * as Tabs from '@/components/lib/ui/tabs';
import { useAccountAccess } from '@/composable/use-account-access';
import { useSyncStatus } from '@/composable/use-sync-status';
import AccountArchiveSection from '@/pages/account/components/account-archive-section.vue';
import AccountDeletionSection from '@/pages/account/components/account-deletion-section.vue';
import AccountDetailsTab from '@/pages/account/components/account-details-tab.vue';
import SettingAccountGroup from '@/pages/account/components/account-group.vue';
import AccountUnlinkSection from '@/pages/account/components/account-unlink-section.vue';
import SettingToggleVisibility from '@/pages/account/components/setting-toggle-visibility.vue';
import SharingPanel from '@/pages/account/components/sharing-panel/sharing-panel.vue';
import { ROUTES_NAMES } from '@/routes';
import { ACCOUNT_TYPES, AccountModel, SHARE_PERMISSIONS } from '@bt/shared/types';
import { useQuery } from '@tanstack/vue-query';
import { AlertTriangleIcon, ExternalLinkIcon } from '@lucide/vue';
import { computed, ref, toRef, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';

import LoadTransactions from './load-transactions.vue';
import ReconcileDuplicates from './reconcile-duplicates.vue';
import SyncTransactions from './sync-transactions.vue';

const { t } = useI18n();

const props = defineProps<{
  account: AccountModel;
}>();

const { data: connections } = useQuery<BankConnection[]>({
  queryKey: VUE_QUERY_CACHE_KEYS.bankConnections,
  queryFn: listConnections,
});

const currentConnection = computed(() =>
  connections.value?.find((c) => c.id === props.account.bankDataProviderConnectionId),
);

const { isAccountNeedingReauth } = useSyncStatus();

const needsReauth = computed(() => isAccountNeedingReauth(props.account));

const { isOwner, permission } = useAccountAccess(toRef(() => props.account));
const canSeeSharingTab = computed(() => isOwner.value || permission.value === SHARE_PERMISSIONS.manage);

const slots = useSlots();
const activeTab = ref('details');
const tabItems = computed(() => {
  const items: { value: string; label: string; icon?: typeof AlertTriangleIcon; iconClass?: string }[] = [
    { value: 'details', label: t('pages.account.tabs.details') },
  ];
  if (isOwner.value) {
    items.push(
      needsReauth.value
        ? {
            value: 'integrations',
            label: t('pages.account.tabs.integrations'),
            icon: AlertTriangleIcon,
            iconClass: 'text-destructive-text',
          }
        : { value: 'integrations', label: t('pages.account.tabs.integrations') },
    );
  }
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
          <component :is="tab.icon" v-if="tab.icon" class="mr-1 size-4" :class="tab.iconClass" aria-hidden="true" />
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

    <Tabs.TabsContent v-if="isOwner" value="integrations">
      <div class="border-border bg-card grid gap-4 rounded-xl border p-4 text-sm">
        <Callout
          v-if="needsReauth && currentConnection"
          variant="destructive"
          :title="$t('pages.account.integrations.reauthBanner.title')"
        >
          <p class="text-muted-foreground text-xs">
            {{ $t('pages.account.integrations.reauthBanner.description') }}
          </p>
          <RouterLink
            :to="{ name: ROUTES_NAMES.accountIntegrationDetails, params: { connectionId: currentConnection.id } }"
            class="text-primary-text hover:text-primary-text/80 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
          >
            {{ $t('pages.account.integrations.reauthBanner.reconnectLink') }}
            <ExternalLinkIcon class="size-3" />
          </RouterLink>
        </Callout>

        <div class="flex items-center justify-between gap-2">
          <span>{{ t('pages.account.integrations.connectedVia') }}</span>
          <RouterLink
            v-if="currentConnection"
            :to="{ name: ROUTES_NAMES.accountIntegrationDetails, params: { connectionId: currentConnection.id } }"
            class="flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            <BankProviderLogo class="size-6" :provider="currentConnection.providerType" />
            {{ currentConnection.providerName }}
            <ExternalLinkIcon class="size-3.5" />
          </RouterLink>
        </div>

        <Separator />

        <SyncTransactions :account="account" />

        <Separator />

        <LoadTransactions :account="account" />

        <template v-if="account.type === ACCOUNT_TYPES.enableBanking">
          <Separator />

          <ReconcileDuplicates :account="account" />
        </template>

        <div class="border-destructive @container/danger-zone mt-2 grid gap-4 rounded-xl border p-4 sm:-mx-4">
          <p class="text-lg font-medium">{{ t('pages.account.deletion.dangerZone') }}</p>
          <AccountUnlinkSection :account="account" />
        </div>
      </div>
    </Tabs.TabsContent>

    <Tabs.TabsContent v-if="canSeeSharingTab" value="sharing">
      <div class="border-border bg-card grid gap-4 rounded-xl border p-4">
        <SharingPanel :account="account" />
      </div>
    </Tabs.TabsContent>
  </DetailTabs>
</template>
