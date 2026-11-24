<script setup lang="ts">
import NavigationSectionTitle from '@/components/sidebar/navigation-section-title.vue';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import Button from '@/components/lib/ui/button/Button.vue';
import { trackAnalyticsEvent } from '@/lib/posthog';
import { PlusIcon } from '@lucide/vue';
import { ref } from 'vue';

import TrackerCreation from './tracker-creation.vue';
import TrackerList from './tracker-list.vue';

const isOpen = ref(false);
const hasTrackers = ref(false);
const openModal = () => {
  isOpen.value = true;
  trackAnalyticsEvent({ event: 'tracker_creation_opened' });
};
const isModalClosed = () => {
  isOpen.value = false;
};
</script>

<template>
  <div class="max-w-5xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <NavigationSectionTitle
          section="planned"
          :label="$t('budgets.title')"
          class="text-2xl font-bold tracking-tight"
        />
        <p class="text-muted-foreground mt-1 text-sm">{{ $t('budgets.description') }}</p>
      </div>
      <Button v-if="hasTrackers" class="shrink-0" @click="openModal">
        <PlusIcon class="size-4" />
        {{ $t('budgets.newBudget') }}
      </Button>
    </div>

    <TrackerList @create="openModal" @has-trackers="hasTrackers = $event" />

    <ResponsiveDialog v-model:open="isOpen">
      <template #title> {{ $t('budgets.createBudget') }} </template>
      <TrackerCreation @create-tracker="isModalClosed" />
    </ResponsiveDialog>
  </div>
</template>
