<script setup lang="ts">
import ContextualHelp from '@/components/common/contextual-help.vue';
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { ROUTES_NAMES } from '@/routes';
import { Button } from '@/components/lib/ui/button';
import { ChevronDownIcon, CircleHelpIcon, LightbulbIcon } from '@lucide/vue';
import { nextTick, ref, useId } from 'vue';

defineProps<{ compactTrigger?: boolean }>();
const advancedOpen = ref(false);
const advancedId = useId();
const advancedSection = ref<HTMLElement>();
const revealAdvanced = () => {
  const section = advancedSection.value;
  if (!section || !advancedOpen.value) return;
  const viewport = section.closest<HTMLElement>('[data-reka-scroll-area-viewport]');
  if (!viewport) return;
  const panel = section.getBoundingClientRect();
  const bounds = viewport.getBoundingClientRect();
  const remaining = Math.min(panel.bottom - bounds.bottom + 8, panel.top - bounds.top - 8);
  if (remaining > 0) {
    viewport.scrollBy({
      top: remaining,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
};
const toggleAdvanced = async () => {
  advancedOpen.value = !advancedOpen.value;
  if (advancedOpen.value && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await nextTick();
    revealAdvanced();
  }
};
const finishAdvancedMotion = (event: TransitionEvent) => {
  if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') revealAdvanced();
};
</script>

<template>
  <ContextualHelp :title="$t('automations.guide.title')">
    <template #trigger>
      <Button
        type="button"
        :size="compactTrigger ? 'icon' : 'sm'"
        :variant="compactTrigger ? 'ghost' : 'soft-primary'"
        :aria-label="compactTrigger ? $t('automations.guide.title') : undefined"
        class="shrink-0"
      >
        <component :is="compactTrigger ? CircleHelpIcon : LightbulbIcon" class="size-4" aria-hidden="true" />
        <template v-if="!compactTrigger">{{ $t('automations.guide.title') }}</template>
      </Button>
    </template>
    <p>{{ $t('automations.guide.intro') }}</p>
    <ol class="list-decimal space-y-2 pl-5">
      <li>{{ $t('automations.guide.choose') }}</li>
      <li>{{ $t('automations.guide.act') }}</li>
      <li>{{ $t('automations.guide.check') }}</li>
    </ol>
    <div class="border-primary/45 bg-muted/40 space-y-1 border-l-2 p-3">
      <p class="font-semibold">{{ $t('automations.guide.exampleTitle') }}</p>
      <p>{{ $t('automations.guide.example') }}</p>
      <p>{{ $t('automations.guide.exampleRun') }}</p>
    </div>
    <div class="border-border bg-muted/40 space-y-1 rounded-md border p-3">
      <p class="font-semibold">{{ $t('automations.guide.secondExampleTitle') }}</p>
      <p>{{ $t('automations.guide.secondExample') }}</p>
    </div>
    <p>{{ $t('automations.guide.noMatch') }}</p>
    <p>{{ $t('automations.guide.schedule') }}</p>
    <RouterLink class="text-primary-text underline" :to="{ name: ROUTES_NAMES.plannedSubscriptions }">
      {{ $t('automations.guide.openRecurring') }}
    </RouterLink>
    <p class="text-muted-foreground">{{ $t('automations.guide.caution') }}</p>
    <section ref="advancedSection" class="border-t pt-2">
      <Button
        type="button"
        variant="ghost"
        class="min-h-11 w-full justify-between px-1 text-left whitespace-normal"
        :aria-controls="advancedId"
        :aria-expanded="advancedOpen"
        @click="toggleAdvanced"
      >
        {{ $t('automations.guide.advanced') }}
        <ChevronDownIcon
          class="size-4 shrink-0 motion-safe:transition-transform"
          :class="advancedOpen && 'rotate-180'"
          aria-hidden="true"
        />
      </Button>
      <LayoutCollapse :id="advancedId" :open="advancedOpen" @transitionend="finishAdvancedMotion">
        <p class="text-muted-foreground px-1 pt-1">{{ $t('automations.mcpTip.text') }}</p>
        <RouterLink
          class="text-primary-text mt-2 inline-flex px-1 underline"
          :to="{ name: ROUTES_NAMES.settingsAiConnectedApps }"
        >
          {{ $t('automations.mcpTip.link') }}
        </RouterLink>
      </LayoutCollapse>
    </section>
  </ContextualHelp>
</template>
