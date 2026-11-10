<script lang="ts" setup>
import Button from '@/components/lib/ui/button/Button.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/common/dropdown-menu';
import { useOnboardingStore } from '@/stores/onboarding';
import { EyeOffIcon, MoveIcon, RotateCcwIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const onboardingStore = useOnboardingStore();
const { isAtDefaultPosition } = storeToRefs(onboardingStore);

const emit = defineEmits<{ dismiss: [] }>();
const isConfirmOpen = ref(false);

const handleConfirm = () => {
  isConfirmOpen.value = false;
  emit('dismiss');
};
</script>

<template>
  <div class="border-t p-4">
    <div class="mb-2 grid grid-cols-2 gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="w-full">
            <EyeOffIcon class="size-4" />
            {{ t('kasana.quickStart.hideButton') }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem @select="onboardingStore.hideTriggerFor(60)">
            {{ t('kasana.quickStart.hideOneHour') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="onboardingStore.hideTriggerFor(24 * 60)">
            {{ t('kasana.quickStart.hideOneDay') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="onboardingStore.hideTriggerFor(7 * 24 * 60)">
            {{ t('kasana.quickStart.hideOneWeek') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="w-full">
            <MoveIcon class="size-4" />
            {{ t('kasana.quickStart.placeButton') }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @select="onboardingStore.setTriggerPosition({ x: 0, y: 0 })">
            {{ t('kasana.quickStart.topLeft') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="onboardingStore.setTriggerPosition({ x: 1, y: 0 })">
            {{ t('kasana.quickStart.topRight') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="onboardingStore.setTriggerPosition({ x: 0, y: 1 })">
            {{ t('kasana.quickStart.bottomLeft') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="onboardingStore.setTriggerPosition({ x: 1, y: 1 })">
            {{ t('kasana.quickStart.bottomRight') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <Button
      variant="ghost"
      size="sm"
      class="mb-2 w-full"
      :disabled="isAtDefaultPosition"
      @click="onboardingStore.resetTriggerPosition()"
    >
      <RotateCcwIcon class="size-4" />
      {{ t('kasana.quickStart.resetPosition') }}
    </Button>
    <p class="text-muted-foreground mb-3 text-xs leading-relaxed">
      {{ t('kasana.quickStart.hideExplanation') }}
    </p>
    <Button variant="ghost-destructive" class="w-full" @click="isConfirmOpen = true">
      {{ t('dashboard.onboarding.quickStart.ui.dismissButton') }}
    </Button>

    <ResponsiveAlertDialog
      v-model:open="isConfirmOpen"
      :confirm-label="t('dashboard.onboarding.quickStart.ui.dismissConfirmButton')"
      confirm-variant="destructive"
      @confirm="handleConfirm"
    >
      <template #title>{{ t('dashboard.onboarding.quickStart.ui.dismissConfirmTitle') }}</template>
      <template #description>{{ t('dashboard.onboarding.quickStart.ui.dismissConfirmDescription') }}</template>
    </ResponsiveAlertDialog>
  </div>
</template>
