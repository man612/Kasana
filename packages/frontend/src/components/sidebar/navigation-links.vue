<script setup lang="ts">
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/lib/ui/collapsible';
import { ROUTES_NAMES } from '@/routes';
import {
  CalendarClockIcon,
  ChartColumnIcon,
  ChevronRightIcon,
  CreditCardIcon,
  LayersIcon,
  LayoutDashboardIcon,
} from '@lucide/vue';
import { watch } from 'vue';

import { SIDEBAR_NAV_CHILDREN, useAccountsNavChildren } from './nav-items';
import { useSidebarNavCollapse } from './use-nav-collapse';
import { useSidebarNavRoutes } from './use-nav-routes';

withDefaults(defineProps<{ bottomNav?: boolean }>(), { bottomNav: false });

const navItemBase = 'w-full gap-2 px-3';
const bottomNavItem =
  'lajur-bottom-nav-item relative flex min-h-14 flex-col justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium leading-tight transition-[background-color,color,transform] duration-220 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.95] motion-reduce:transition-none';
const navItemActive = 'lajur-bottom-nav-active bg-primary/10 text-foreground';
const navIconBase = 'size-4 shrink-0';
const navIconActive = 'text-primary-text';

const { isAccountsOpen, isTransactionsOpen, isPlannedOpen } = useSidebarNavCollapse();
const { isAccountsRoute, isTransactionsRoute, isPlannedRoute, isChildActive } = useSidebarNavRoutes();
const accountsNavChildren = useAccountsNavChildren();

watch(
  isAccountsRoute,
  (val) => {
    if (val) isAccountsOpen.value = true;
  },
  { immediate: true },
);

watch(
  isTransactionsRoute,
  (val) => {
    if (val) isTransactionsOpen.value = true;
  },
  { immediate: true },
);

watch(
  isPlannedRoute,
  (val) => {
    if (val) isPlannedOpen.value = true;
  },
  { immediate: true },
);
</script>

<template>
  <router-link v-slot="{ isActive }" :to="{ name: ROUTES_NAMES.home }">
    <ui-button
      variant="ghost"
      as="span"
      :class="[bottomNav ? bottomNavItem : navItemBase + ' justify-start', isActive && navItemActive]"
      size="default"
    >
      <LayoutDashboardIcon :class="[navIconBase, bottomNav && 'size-5', isActive && navIconActive]" />
      <span :class="bottomNav && 'text-[11px] leading-tight'"> {{ $t('navigation.dashboard') }} </span>
    </ui-button>
  </router-link>

  <template v-if="bottomNav">
    <router-link v-slot="{ isActive }" :to="{ name: ROUTES_NAMES.accounts }">
      <ui-button variant="ghost" as="span" :class="[bottomNavItem, (isActive || isAccountsRoute) && navItemActive]" size="default">
        <LayersIcon :class="[navIconBase, bottomNav && 'size-5', (isActive || isAccountsRoute) && navIconActive]" />
        <span class="text-[11px] leading-tight"> {{ $t('navigation.accounts') }} </span>
      </ui-button>
    </router-link>
  </template>
  <router-link v-else-if="accountsNavChildren.length === 1" :to="{ name: ROUTES_NAMES.accounts }">
    <ui-button
      variant="ghost"
      as="span"
      :class="[navItemBase, 'justify-start', isAccountsRoute && navItemActive]"
      size="default"
    >
      <LayersIcon :class="[navIconBase, isAccountsRoute && navIconActive]" />
      <span> {{ $t('navigation.accounts') }} </span>
    </ui-button>
  </router-link>
  <Collapsible v-else v-model:open="isAccountsOpen">
    <CollapsibleTrigger class="w-full">
      <ui-button
        variant="ghost"
        as="div"
        :class="['w-full justify-start gap-2 px-3', isAccountsRoute && 'bg-primary/10']"
        size="default"
      >
        <LayersIcon :class="[navIconBase, isAccountsRoute && navIconActive]" />
        <span>{{ $t('navigation.accounts') }}</span>
        <ChevronRightIcon
          :class="['ml-auto size-4 shrink-0 transition-transform duration-200', { 'rotate-90': isAccountsOpen }]"
        />
      </ui-button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="border-border/40 mt-1 ml-2 grid gap-0.5 border-l pl-2">
        <router-link
          v-for="child in accountsNavChildren"
          :key="child.routeName"
          v-slot="{ isActive }"
          :to="{ name: child.routeName }"
        >
          <ui-button
            variant="ghost"
            as="span"
            :class="['w-full justify-start gap-2 px-3', isChildActive({ child, isActive }) && navItemActive]"
            size="sm"
          >
            <component :is="child.icon" :class="[navIconBase, isChildActive({ child, isActive }) && navIconActive]" />
            <span>{{ $t(child.labelKey) }}</span>
          </ui-button>
        </router-link>
      </div>
    </CollapsibleContent>
  </Collapsible>

  <template v-if="bottomNav">
    <router-link v-slot="{ isActive }" :to="{ name: ROUTES_NAMES.transactions }">
      <ui-button variant="ghost" as="span" :class="[bottomNavItem, (isActive || isTransactionsRoute) && navItemActive]" size="default">
        <CreditCardIcon :class="[navIconBase, bottomNav && 'size-5', (isActive || isTransactionsRoute) && navIconActive]" />
        <span class="text-[11px] leading-tight"> {{ $t('navigation.transactions') }} </span>
      </ui-button>
    </router-link>
  </template>
  <Collapsible v-else v-model:open="isTransactionsOpen">
    <CollapsibleTrigger class="w-full">
      <ui-button
        variant="ghost"
        as="div"
        :class="['w-full justify-start gap-2 px-3', isTransactionsRoute && 'bg-primary/10']"
        size="default"
      >
        <CreditCardIcon :class="[navIconBase, isTransactionsRoute && navIconActive]" />
        <span>{{ $t('navigation.transactions') }}</span>
        <ChevronRightIcon
          :class="['ml-auto size-4 shrink-0 transition-transform duration-200', { 'rotate-90': isTransactionsOpen }]"
        />
      </ui-button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="border-border/40 mt-1 ml-2 grid gap-0.5 border-l pl-2">
        <router-link
          v-for="child in SIDEBAR_NAV_CHILDREN.transactions"
          :key="child.routeName"
          v-slot="{ isActive }"
          :to="{ name: child.routeName }"
        >
          <ui-button
            variant="ghost"
            as="span"
            :class="['w-full justify-start gap-2 px-3', isChildActive({ child, isActive }) && navItemActive]"
            size="sm"
          >
            <component :is="child.icon" :class="[navIconBase, isChildActive({ child, isActive }) && navIconActive]" />
            <span>{{ $t(child.labelKey) }}</span>
          </ui-button>
        </router-link>
      </div>
    </CollapsibleContent>
  </Collapsible>

  <Collapsible v-if="!bottomNav" v-model:open="isPlannedOpen">
    <CollapsibleTrigger class="w-full">
      <ui-button
        variant="ghost"
        as="div"
        :class="['w-full justify-start gap-2 px-3', isPlannedRoute && 'bg-primary/10']"
        size="default"
      >
        <CalendarClockIcon :class="[navIconBase, isPlannedRoute && navIconActive]" />
        <span>{{ $t('navigation.planned.planned') }}</span>
        <ChevronRightIcon
          :class="['ml-auto size-4 shrink-0 transition-transform duration-200', { 'rotate-90': isPlannedOpen }]"
        />
      </ui-button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="border-border/40 mt-1 ml-2 grid gap-0.5 border-l pl-2">
        <router-link
          v-for="child in SIDEBAR_NAV_CHILDREN.planned"
          :key="child.routeName"
          v-slot="{ isActive }"
          :to="{ name: child.routeName }"
        >
          <ui-button
            variant="ghost"
            as="span"
            :class="['w-full justify-start gap-2 px-3', isChildActive({ child, isActive }) && navItemActive]"
            size="sm"
          >
            <component :is="child.icon" :class="[navIconBase, isChildActive({ child, isActive }) && navIconActive]" />
            <span>{{ $t(child.labelKey) }}</span>
          </ui-button>
        </router-link>
      </div>
    </CollapsibleContent>
  </Collapsible>

  <router-link v-slot="{ isActive }" :to="{ name: ROUTES_NAMES.analytics }">
    <ui-button
      variant="ghost"
      as="span"
      :class="[bottomNav ? bottomNavItem : navItemBase + ' justify-start', isActive && navItemActive]"
      size="default"
    >
      <ChartColumnIcon :class="[navIconBase, bottomNav && 'size-5', isActive && navIconActive]" />
      <span :class="bottomNav && 'text-[11px] leading-tight'"> {{ $t('navigation.analytics') }} </span>
    </ui-button>
  </router-link>
</template>
