<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { CircleHelpIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{ content: string }>();
const { locale } = useI18n();
const heading = computed(() => (locale.value.startsWith('id') ? 'Penjelasan' : 'More information'));
const isOpen = ref(false);
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen">
    <template #trigger>
      <button
        type="button"
        class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
        :aria-label="heading"
        :title="heading"
      >
        <CircleHelpIcon class="size-4" aria-hidden="true" />
      </button>
    </template>
    <template #title>{{ heading }}</template>
    <template #description>{{
      locale.startsWith('id') ? 'Bantuan mengenai fungsi dan penggunaannya.' : 'Details about this feature.'
    }}</template>
    <div class="border-border bg-muted/30 text-foreground rounded-xl border p-4 text-sm leading-relaxed">
      {{ content }}
    </div>
  </ResponsiveDialog>
</template>
