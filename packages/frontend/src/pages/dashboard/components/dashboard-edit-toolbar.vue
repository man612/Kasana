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
        :class="
          isCompact &&
          'relative grid size-11 place-items-center border-transparent bg-transparent p-0 hover:bg-transparent'
        "
        :aria-label="$t('dashboard.editMode.customize')"
        @click="emit('enter')"
      >
        <span
          v-if="isCompact"
          class="border-border bg-card pointer-events-none absolute inset-1.5 rounded-lg border"
          aria-hidden="true"
        />
        <SlidersHorizontalIcon
          :class="isCompact ? 'relative size-[0.7rem]' : 'size-3.5'"
          :stroke-width="isCompact ? 1.75 : 2"
          aria-hidden="true"
        />
        <span :class="isCompact && 'sr-only'">{{ $t('dashboard.editMode.customize') }}</span>
      </Button>
    </Transition>
  </div>
</template>
