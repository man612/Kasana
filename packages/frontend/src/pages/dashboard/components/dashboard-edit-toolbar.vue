<script lang="ts" setup>
import { Button } from '@/components/lib/ui/button';
import { SettingsIcon } from '@lucide/vue';

defineProps<{
  isEditMode: boolean;
  compactMobile?: boolean;
}>();

const emit = defineEmits<{
  enter: [];
  save: [];
  cancel: [];
}>();
</script>

<template>
  <div class="flex items-center gap-2">
    <Transition name="kasana-section" mode="out-in">
      <div v-if="isEditMode" key="editing" class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="emit('cancel')"> {{ $t('common.actions.cancel') }} </Button>
        <Button size="sm" @click="emit('save')"> {{ $t('common.actions.done') }} </Button>
      </div>
      <Button
        v-else
        key="ready"
        variant="outline"
        :size="compactMobile ? 'icon' : 'sm'"
        :class="compactMobile && 'max-md:size-11 max-md:rounded-xl'"
        :aria-label="$t('dashboard.editMode.customize')"
        @click="emit('enter')"
      >
        <SettingsIcon :class="['size-4', !compactMobile && 'mr-1.5 md:size-3.5']" />
        <span :class="compactMobile && 'max-md:sr-only'">{{ $t('dashboard.editMode.customize') }}</span>
      </Button>
    </Transition>
  </div>
</template>
