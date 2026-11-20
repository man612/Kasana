<script setup lang="ts">
import { getMonogramTextColor } from '@/common/utils/monogram-color';
import { Icon } from '@iconify/vue';
import { LayersIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

const props = defineProps<{ icon?: string | null; color?: string | null }>();
const iconName = computed(() => (props.icon ? `fluent:${props.icon}` : null));
const loadedIcon = ref<string>();
const colors = computed(() =>
  props.color ? { backgroundColor: props.color, color: getMonogramTextColor({ hex: props.color }) } : undefined,
);
</script>

<template>
  <span
    class="bg-primary/10 text-primary-text grid size-9 shrink-0 place-items-center rounded-lg motion-safe:transition-colors motion-safe:duration-150"
    :style="colors"
    aria-hidden="true"
  >
    <LayersIcon v-if="!iconName || loadedIcon !== iconName" class="col-start-1 row-start-1 size-4" />
    <Icon
      v-if="iconName"
      :icon="iconName"
      height="20"
      width="20"
      class="col-start-1 row-start-1"
      @load="loadedIcon = $event"
    />
  </span>
</template>
