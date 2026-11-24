<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/common/dropdown-menu';
import { Button } from '@/components/lib/ui/button';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { SIDEBAR_NAV_CHILDREN, useAccountsNavChildren } from './nav-items';
import { useSidebarNavRoutes } from './use-nav-routes';

const props = defineProps<{ section: keyof typeof SIDEBAR_NAV_CHILDREN; label: string }>();
const route = useRoute();
const router = useRouter();
const { isChildActive } = useSidebarNavRoutes();
const accountChildren = useAccountsNavChildren();
const children = computed(() =>
  props.section === 'accounts' ? accountChildren.value : SIDEBAR_NAV_CHILDREN[props.section],
);
const open = ref(false);
const destination = ref<string>();
const activeChild = computed(() =>
  children.value.find((child) =>
    isChildActive({ child, isActive: route.matched.some(({ name }) => name === child.routeName) }),
  ),
);

const navigateAfterClose = (event: Event) => {
  if (!destination.value) return;
  const name = destination.value;
  destination.value = undefined;
  if (name === route.name) return;
  event.preventDefault();
  void router.push({ name }).catch(() => undefined);
};
</script>

<template>
  <h1 class="min-w-0">
    <DropdownMenu v-model:open="open">
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          class="h-auto min-h-10 max-w-full gap-1 rounded-lg px-0 text-left text-[length:inherit] leading-[inherit] font-[number:inherit] whitespace-normal"
          data-testid="section-navigation-title"
        >
          <span class="min-w-0 [overflow-wrap:anywhere]">{{ label }}</span>
          <ChevronDownIcon
            aria-hidden="true"
            :class="
              cn('text-muted-foreground size-3.5 shrink-0 motion-safe:transition-transform', open && 'rotate-180')
            "
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="min-w-44" @close-auto-focus="navigateAfterClose">
        <DropdownMenuItem
          v-for="entry in children"
          :key="entry.routeName"
          :aria-current="entry === activeChild ? 'page' : undefined"
          :class="cn('min-h-10 gap-2', entry === activeChild && 'bg-accent')"
          @select="destination = entry.routeName"
        >
          <component :is="entry.icon" aria-hidden="true" class="size-4 shrink-0" />
          <span class="flex-1">{{ $t(entry.labelKey) }}</span>
          <CheckIcon v-if="entry === activeChild" aria-hidden="true" class="text-primary-text size-4 shrink-0" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </h1>
</template>
