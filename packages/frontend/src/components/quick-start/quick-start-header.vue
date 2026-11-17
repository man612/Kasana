<script lang="ts" setup>
import Button from '@/components/lib/ui/button/Button.vue';
import { XIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  progress: number;
  completedCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div class="border-b p-4">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-lg font-semibold">{{ t('dashboard.onboarding.quickStart.ui.title') }}</h2>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-11"
        :aria-label="t('common.ui.close')"
        @click="emit('close')"
      >
        <XIcon class="size-4" aria-hidden="true" />
      </Button>
    </div>

    <p class="text-muted-foreground mb-3 text-sm">{{ t('dashboard.onboarding.quickStart.ui.subtitle') }}</p>

    <!-- Progress bar -->
    <div class="space-y-1.5">
      <div
        role="progressbar"
        :aria-label="t('dashboard.onboarding.quickStart.ui.title')"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
        class="bg-muted h-2 overflow-hidden rounded-full"
      >
        <div
          class="bg-primary h-full transition-all duration-500 ease-out motion-reduce:transition-none"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <div class="text-muted-foreground flex justify-between text-xs">
        <span>{{
          t('dashboard.onboarding.quickStart.ui.progressText', { completed: completedCount, total: totalCount })
        }}</span>
        <span>{{ progress }}%</span>
      </div>
    </div>
  </div>
</template>
