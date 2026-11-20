<script setup lang="ts">
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
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
        <div class="truncate text-[17px] leading-5 font-semibold tracking-tight">{{ APP_BRAND.name }}</div>
      </div>
    </CardHeader>
    <CardContent class="flex min-h-0 grow flex-col gap-3 px-3 pt-0 pb-3 sm:p-3 sm:pt-0">
      <nav
        class="grid shrink-0 gap-0.5"
        :class="mobileView ? 'max-h-[35dvh] overflow-y-auto [&_span]:wrap-anywhere [&_span]:whitespace-normal' : ''"
      >
        <NavigationLinks />
      </nav>
      <div class="bg-border/50 mx-1 h-px" />
      <AccountsView :class="mobileView ? 'min-h-0!' : ''" />
      <div v-if="!mobileView" class="bg-border/50 mx-1 h-px" />
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
