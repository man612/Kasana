<script setup lang="ts">
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import type { SCROLL_AREA_IDS } from '@/components/lib/ui/scroll-area/types';
import { Tabs } from '@/components/lib/ui/tabs';
import { useHorizontalTabSwipe } from '@/composable/use-horizontal-tab-swipe';
import { useTemplateRef, watch } from 'vue';

const props = defineProps<{ values: string[]; scrollAreaId?: SCROLL_AREA_IDS }>();
const selected = defineModel<string>({ required: true });
const viewport = useTemplateRef<InstanceType<typeof ScrollArea>>('viewport');
const { begin, end, cancel } = useHorizontalTabSwipe({
  current: selected,
  values: () => props.values,
  select: (value) => (selected.value = value),
});

watch(
  selected,
  () => {
    const element = viewport.value?.viewportRef?.viewportElement;
    element?.scrollTo({ top: 0, behavior: 'instant' });
    const selectedTab = element?.closest('.lajur-detail-tabs')?.querySelector('[role="tab"][aria-selected="true"]');
    const list = selectedTab?.closest('[role="tablist"]');
    if (!list || !selectedTab) return;
    const view = list.getBoundingClientRect();
    const tab = selectedTab.getBoundingClientRect();
    if (tab.left < view.left) list.scrollBy({ left: tab.left - view.left - 4 });
    else if (tab.right > view.right) list.scrollBy({ left: tab.right - view.right + 4 });
  },
  { flush: 'post' },
);
</script>

<template>
  <Tabs v-model="selected" class="lajur-detail-tabs flex min-h-0 min-w-0 flex-1 flex-col gap-2">
    <slot name="tabs" />
    <ScrollArea
      ref="viewport"
      :scroll-area-id="scrollAreaId"
      data-tab-swipe
      class="lajur-detail-scroll min-h-0 min-w-0 flex-1 touch-pan-y"
      viewport-class="lajur-detail-scroll-viewport"
      @touchstart.passive="begin"
      @touchend.passive="end"
      @touchcancel="cancel"
    >
      <slot />
    </ScrollArea>
  </Tabs>
</template>
