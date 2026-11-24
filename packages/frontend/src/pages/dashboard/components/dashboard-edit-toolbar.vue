<script lang="ts" setup>
import { Button } from '@/components/lib/ui/button';
import { SlidersHorizontalIcon } from '@lucide/vue';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { computed } from 'vue';

const props = defineProps<{
  isEditMode: boolean;
  compactMobile?: boolean;
}>();
const isMobileView = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
const isCompact = computed(() => Boolean(props.compactMobile && isMobileView.value));

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
        :size="isCompact ? 'icon' : 'sm'"
        :class="isCompact && 'grid size-11 place-items-center rounded-xl p-0'"
        :aria-label="$t('dashboard.editMode.customize')"
        @click="emit('enter')"
      >
        <SlidersHorizontalIcon
          :class="isCompact ? 'size-[0.7rem]' : 'size-3.5'"
          :stroke-width="isCompact ? 1.75 : 2"
          aria-hidden="true"
        />
        <span :class="isCompact && 'sr-only'">{{ $t('dashboard.editMode.customize') }}</span>
      </Button>
    </Transition>
  </div>
</template>
