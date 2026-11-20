<script setup lang="ts">
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { SCROLL_AREA_IDS } from '@/components/lib/ui/scroll-area/types';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { APP_BRAND } from '@/common/brand';
import { PanelLeftIcon } from '@lucide/vue';
import AccountsView from './accounts-view/index.vue';
import NavigationLinks from './navigation-links.vue';
import UserMenu from './user-menu.vue';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

defineProps<{ mobileView?: boolean }>();
const { isCollapsed } = useSidebarCollapsed();
</script>

<template>
  <component :is="mobileView ? 'div' : Card" class="flex h-full w-75 min-w-0 flex-col rounded-none max-md:w-auto">
    <CardHeader class="h-16 shrink-0 px-4 py-3" :class="mobileView ? 'pr-16' : ''">
      <div class="flex h-full items-center">
        <div
          class="truncate tracking-tight"
          :class="mobileView ? 'text-2xl leading-tight font-bold' : 'text-[17px] leading-5 font-semibold'"
        >
          {{ APP_BRAND.name }}
        </div>
      </div>
    </CardHeader>
    <CardContent class="flex min-h-0 grow flex-col gap-3 px-3 pt-0 pb-3 sm:p-3 sm:pt-0">
      <ScrollArea v-if="mobileView" :scroll-area-id="SCROLL_AREA_IDS.sidebarAccounts" class="min-h-0 flex-1">
        <nav>
          <NavigationLinks />
        </nav>
        <div class="bg-border/50 mx-1 my-3 h-px" />
        <AccountsView single-scroll />
      </ScrollArea>
      <template v-else>
        <nav class="shrink-0">
          <NavigationLinks />
        </nav>
        <div class="bg-border/50 mx-1 h-px" />
        <AccountsView />
        <div class="bg-border/50 mx-1 h-px" />
      </template>
      <UserMenu :elevated="mobileView">
        <template #trailing>
          <DesktopOnlyTooltip v-if="!mobileView" :content="$t('sidebar.collapse')">
            <UiButton variant="ghost" size="icon-sm" :aria-label="$t('sidebar.collapse')" @click="isCollapsed = true">
              <PanelLeftIcon class="size-4" />
            </UiButton>
          </DesktopOnlyTooltip>
        </template>
      </UserMenu>
    </CardContent>
  </component>
</template>
