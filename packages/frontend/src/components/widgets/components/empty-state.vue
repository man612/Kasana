<template>
  <div :class="['flex flex-col items-center justify-center opacity-70', isDashboard ? 'min-h-40 py-3' : 'min-h-[220px]']">
    <slot></slot>
    <p class="mt-4 text-center text-sm">{{ t('dashboard.widgets.emptyState') }}</p>
  </div>
</template>

<script lang="ts" setup>
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const isDashboard = inject<boolean>('dashboard-widget-stretch', false);
</script>
