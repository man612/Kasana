<script setup lang="ts">
import LogoIconFields from '@/components/common/logo-icon-fields.vue';
import { DEFAULT_MONOGRAM_COLOR } from '@/components/common/logo-selection';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { PencilIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';

import GroupIcon from './group-icon.vue';

defineProps<{ name: string }>();
const icon = defineModel<string>({ required: true });
const color = defineModel<string | null>('color', { required: true });
const open = ref(false);
const draftIcon = ref('');
const draftColor = ref<string | null>(null);
const paletteColor = computed({
  get: () => draftColor.value ?? DEFAULT_MONOGRAM_COLOR,
  set: (value) => {
    draftColor.value = value;
  },
});
const heading = ref<HTMLElement | null>(null);

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    draftIcon.value = icon.value;
    draftColor.value = color.value;
  },
  { flush: 'sync' },
);

const dirty = computed(() => draftIcon.value !== icon.value || draftColor.value !== color.value);
const restoreDefault = () => {
  draftIcon.value = '';
  draftColor.value = null;
};

const apply = () => {
  if (!dirty.value) return;
  icon.value = draftIcon.value;
  color.value = draftColor.value;
  open.value = false;
};
</script>

<template>
  <ResponsiveDialog
    v-model:open="open"
    raised
    intrinsic-height-motion
    mobile-presentation="center"
    dialog-content-class="max-w-md gap-3 p-4 sm:p-5"
    @open-auto-focus.prevent="heading?.focus({ preventScroll: true })"
  >
    <template #trigger>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="relative size-11 shrink-0"
        :aria-label="$t('transactions.transactionGroups.icon.label')"
      >
        <GroupIcon :icon="icon" :color="color" />
        <PencilIcon class="text-muted-foreground bg-background absolute right-0.5 bottom-0.5 size-3 rounded-sm" />
      </Button>
    </template>
    <template #title>
      <span ref="heading" tabindex="-1" class="outline-none">{{
        $t('transactions.transactionGroups.icon.label')
      }}</span>
    </template>

    <LogoIconFields
      v-model:icon="draftIcon"
      v-model:color="paletteColor"
      :name="name"
      :autofocus="false"
      :allow-clear="false"
    >
      <template #preview><GroupIcon :icon="draftIcon" :color="draftColor" class="size-11" /></template>
    </LogoIconFields>
    <Button
      type="button"
      variant="link"
      size="sm"
      class="mt-1 px-0"
      :aria-pressed="!draftIcon && !draftColor"
      @click="restoreDefault"
    >
      {{ $t('transactions.transactionGroups.icon.default') }}
    </Button>

    <template #footer="{ close }">
      <div class="grid w-full grid-cols-2 gap-2 border-t pt-3">
        <Button type="button" variant="outline" class="min-h-11" @click="close">{{
          $t('common.actions.cancel')
        }}</Button>
        <Button type="button" class="min-h-11" :disabled="!dirty" data-test="logo-icon-apply" @click="apply">
          {{ $t('common.actions.apply') }}
        </Button>
      </div>
    </template>
  </ResponsiveDialog>
</template>
