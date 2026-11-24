<script setup lang="ts">
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { Button, buttonVariants } from '@/components/lib/ui/button';
import { cn } from '@/lib/utils';
import { loadChunksForRoute } from '@/i18n';
import { ROUTES_NAMES } from '@/routes/constants';
import { useEventListener, usePreferredReducedMotion, createReusableTemplate } from '@vueuse/core';
import {
  CalendarClockIcon,
  ChartColumnIcon,
  ChevronRightIcon,
  CreditCardIcon,
  LayersIcon,
  LayoutDashboardIcon,
} from '@lucide/vue';
import { computed, nextTick, onScopeDispose, ref, watch, type Component } from 'vue';
import { loadRouteLocation, useRoute, useRouter } from 'vue-router';

import { SIDEBAR_NAV_CHILDREN, useAccountsNavChildren, type SidebarNavChild } from './nav-items';
import { useSidebarNavCollapse } from './use-nav-collapse';
import { useSidebarNavRoutes } from './use-nav-routes';

const props = defineProps<{ bottomNav?: boolean }>();
const route = useRoute();
const router = useRouter();
const warmed = new Set<string>();
const warmRoute = ({ name }: { name: string }) => {
  if (name === route.name || warmed.has(name) || !navigator.onLine) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (connection?.saveData || connection?.effectiveType?.endsWith('2g')) return;
  warmed.add(name);
  const target = router.resolve({ name });
  void Promise.all([loadRouteLocation(target), loadChunksForRoute({ route: target })]).catch(() => warmed.delete(name));
};
const nav = ref<HTMLElement | null>(null);
const pendingHref = ref('');
const reducedMotion = usePreferredReducedMotion();
const [DefineRouteLink, RouteLink] = createReusableTemplate<{
  name: string;
  label: string;
  icon: Component;
  active: boolean;
  nested?: boolean;
}>();
const { isAccountsOpen, isTransactionsOpen, isPlannedOpen } = useSidebarNavCollapse();
const { isAccountsRoute, isTransactionsRoute, isPlannedRoute, isChildActive } = useSidebarNavRoutes();
const accountChildren = useAccountsNavChildren();

const normalClasses =
  'relative h-auto min-h-10 w-full min-w-0 justify-start px-3 text-left whitespace-normal active:bg-accent';
const iconClasses = 'size-4 shrink-0 motion-safe:transition-[color,transform] motion-safe:duration-200';
const bottomClasses =
  'relative flex min-h-14 min-w-0 flex-col justify-center gap-1 rounded-xl px-1 py-1.5 text-xs font-medium leading-tight motion-safe:transition-transform motion-safe:duration-180 active:scale-[0.96] active:bg-accent';

const primary = [
  {
    name: ROUTES_NAMES.home,
    label: 'navigation.dashboard',
    icon: LayoutDashboardIcon,
    active: computed(() => route.name === ROUTES_NAMES.home),
  },
  { name: ROUTES_NAMES.accounts, label: 'navigation.accounts', icon: LayersIcon, active: isAccountsRoute },
  {
    name: ROUTES_NAMES.transactions,
    label: 'navigation.transactions',
    icon: CreditCardIcon,
    active: isTransactionsRoute,
  },
  {
    name: ROUTES_NAMES.analytics,
    label: 'navigation.analytics',
    icon: ChartColumnIcon,
    active: computed(() => route.matched.some((item) => item.name === ROUTES_NAMES.analytics)),
  },
];
const activeColumn = computed(() => primary.findIndex(({ active }) => active.value));
const groups = [
  { ...primary[1]!, open: isAccountsOpen, children: accountChildren },
  { ...primary[2]!, open: isTransactionsOpen, children: computed(() => SIDEBAR_NAV_CHILDREN.transactions) },
  {
    name: 'planned',
    label: 'navigation.planned.planned',
    icon: CalendarClockIcon,
    active: isPlannedRoute,
    open: isPlannedOpen,
    children: computed(() => SIDEBAR_NAV_CHILDREN.planned),
  },
];

const activeChild = (children: SidebarNavChild[]) =>
  children.find((child) => child.routeName === route.name) ??
  children.find((child) =>
    isChildActive({ child, isActive: route.matched.some((item) => item.name === child.routeName) }),
  );
watch(
  () => route.meta.navSection,
  () => {
    if (!props.bottomNav) {
      const group = groups.find(({ active }) => active.value);
      if (group) group.open.value = true;
    }
  },
  { immediate: true },
);

let navigationFrame = 0;
let navigationTimer: ReturnType<typeof setTimeout>;
let navigationRequest = 0;
const cancelPending = () => {
  cancelAnimationFrame(navigationFrame);
  clearTimeout(navigationTimer);
  navigationRequest++;
  pendingHref.value = '';
};
const onActivate = (event: MouseEvent, href: string, navigate: () => Promise<unknown>) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
    return;
  event.preventDefault();
  cancelPending();
  pendingHref.value = href;
  const request = navigationRequest;

  // Paint feedback before the route resolves and mounts its page. Keep only the latest tap.
  navigationFrame = requestAnimationFrame(() => {
    navigationTimer = setTimeout(() => {
      void navigate()
        .finally(() => {
          if (request === navigationRequest) pendingHref.value = '';
        })
        .catch(() => undefined);
    }, 0);
  });
};

let move: Animation | undefined;
const getActiveSurface = () => nav.value?.querySelector<HTMLElement>('[data-nav-current] > [data-nav-highlight]');
watch(
  () => route.fullPath,
  async () => {
    if (props.bottomNav || reducedMotion.value === 'reduce') return;
    const previous = getActiveSurface();
    const before = previous?.getBoundingClientRect();
    await nextTick();
    const current = getActiveSurface();
    if (!before || !current || current === previous || !current.animate) return;
    move?.cancel();
    const after = current.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    const nearby = Math.abs(dy) <= 120;
    move = current.animate(
      nearby
        ? [
            { transform: `translate3d(${dx}px,${dy}px,0)`, opacity: 0.8 },
            { transform: 'none', opacity: 1 },
          ]
        : [{ opacity: 0 }, { opacity: 1 }],
      { duration: nearby ? 220 : 150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  },
);
useEventListener(window, 'popstate', cancelPending);
onScopeDispose(() => {
  cancelPending();
  move?.cancel();
});
</script>

<template>
  <DefineRouteLink v-slot="{ name, label, icon, active, nested }">
    <RouterLink v-slot="{ href, navigate }" :to="{ name }" custom>
      <a
        :href="href"
        :aria-current="active ? 'page' : undefined"
        :data-nav-current="active || undefined"
        :data-nav-pending="pendingHref === href || undefined"
        :class="
          cn(
            buttonVariants({ variant: 'ghost', size: nested ? 'sm' : 'default' }),
            bottomNav ? bottomClasses : normalClasses,
            active && 'text-foreground',
            'data-[nav-pending]:bg-accent',
          )
        "
        @pointerenter="$event.pointerType === 'mouse' && warmRoute({ name })"
        @pointerdown="$event.isPrimary && warmRoute({ name })"
        @focus="warmRoute({ name })"
        @click="onActivate($event, href, navigate)"
      >
        <span
          v-if="active && !bottomNav"
          data-nav-highlight
          aria-hidden="true"
          class="bg-primary/10 pointer-events-none absolute inset-0 rounded-[inherit]"
        />
        <component
          :is="icon"
          :class="
            cn(
              'relative',
              iconClasses,
              bottomNav && 'size-5',
              active && 'text-primary-text',
              bottomNav && active && '-translate-y-0.5',
            )
          "
          aria-hidden="true"
        />
        <span class="relative min-w-0 wrap-anywhere">{{ $t(label) }}</span>
      </a>
    </RouterLink>
  </DefineRouteLink>

  <div ref="nav" :class="bottomNav ? 'relative isolate grid grid-cols-4 gap-1' : 'grid gap-0.5'">
    <template v-if="bottomNav">
      <span
        data-nav-highlight
        aria-hidden="true"
        class="bottom-indicator bg-primary/10 pointer-events-none absolute inset-y-0 left-0 -z-10 rounded-xl motion-safe:transition-[transform,opacity] motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
        :class="activeColumn < 0 && 'opacity-0'"
        :style="{ '--nav-active-column': Math.max(0, activeColumn) }"
      >
        <span
          class="bg-primary-text absolute top-0.5 left-1/2 h-0.75 w-6 -translate-x-1/2 rounded-full"
          data-nav-active-rail
        />
      </span>
      <RouteLink v-for="item in primary" :key="item.name" v-bind="item" :active="item.active.value" />
    </template>
    <template v-else>
      <RouteLink v-bind="primary[0]!" :active="primary[0]!.active.value" />
      <template v-for="group in groups" :key="group.name">
        <RouteLink
          v-if="group.name === ROUTES_NAMES.accounts && group.children.value.length === 1"
          v-bind="group"
          :active="group.active.value"
        />
        <div v-else>
          <Button
            type="button"
            variant="ghost"
            :class="normalClasses"
            :aria-expanded="group.open.value"
            :data-nav-current="
              (group.active.value && (!group.open.value || !activeChild(group.children.value))) || undefined
            "
            @click="group.open.value = !group.open.value"
          >
            <span
              v-if="group.active.value && (!group.open.value || !activeChild(group.children.value))"
              data-nav-highlight
              aria-hidden="true"
              class="bg-primary/10 pointer-events-none absolute inset-0 rounded-[inherit]"
            />
            <component
              :is="group.icon"
              :class="cn('relative', iconClasses, group.active.value && 'text-primary-text')"
              aria-hidden="true"
            />
            <span class="relative min-w-0 flex-1 wrap-anywhere">{{ $t(group.label) }}</span>
            <ChevronRightIcon
              :class="cn(iconClasses, 'relative', group.open.value && 'rotate-90')"
              aria-hidden="true"
            />
          </Button>
          <LayoutCollapse :open="group.open.value">
            <div class="border-border/40 mt-1 ml-2 grid gap-0.5 border-l pl-2">
              <RouteLink
                v-for="item in group.children.value"
                :key="item.routeName"
                :name="item.routeName"
                :label="item.labelKey"
                :icon="item.icon"
                :active="group.open.value && activeChild(group.children.value) === item"
                nested
              />
            </div>
          </LayoutCollapse>
        </div>
      </template>
      <RouteLink v-bind="primary[3]!" :active="primary[3]!.active.value" />
    </template>
  </div>
</template>

<style scoped>
.bottom-indicator {
  width: calc((100% - 3 * var(--spacing)) / 4);
  transform: translateX(calc(var(--nav-active-column) * (100% + var(--spacing))));
}
</style>
