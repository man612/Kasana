<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { LayersIcon } from '@lucide/vue';
import { computed } from 'vue';

import fluentFilledIcons from '@/data/fluent-filled-icons.json';

const props = defineProps<{ icon?: string | null }>();
const iconName = computed(() => (props.icon && fluentFilledIcons.includes(props.icon) ? `fluent:${props.icon}` : null));
</script>

<template>
  <span class="bg-primary/10 text-primary-text grid size-9 shrink-0 place-items-center rounded-lg" aria-hidden="true">
    <Icon v-if="iconName" :icon="iconName" height="20" width="20" class="col-start-1 row-start-1" />
    <LayersIcon v-else class="size-4" />
  </span>
</template>
